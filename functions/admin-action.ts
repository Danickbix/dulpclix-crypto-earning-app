import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

const ADMIN_EMAIL = "Danickbix@gmail.com";

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Missing server config" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const blink = createClient({ projectId, secretKey });

    // Verify JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid token", details: auth.error }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check admin access by email
    if (auth.email !== ADMIN_EMAIL) {
      // Also check profile role as fallback
      const profiles = await blink.db.table("profiles").list({
        where: { userId: auth.userId },
      });
      const profile = profiles[0];
      if (!profile || profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Forbidden - not admin" }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get_stats": {
        const totalUsers = await blink.db.table("profiles").count();
        const pendingWithdrawals = await blink.db
          .table("withdrawals")
          .count({ where: { status: "pending" } });
        const today = new Date().toISOString().split("T")[0];
        const todayEmission = await blink.db
          .table("daily_emissions")
          .get(today);

        return new Response(
          JSON.stringify({
            totalUsers,
            pendingWithdrawals,
            dailyEmission: todayEmission?.totalEmitted || 0,
          }),
          { headers: corsHeaders }
        );
      }

      case "list_withdrawals": {
        const withdrawals = await blink.db.table("withdrawals").list({
          orderBy: { createdAt: "desc" },
          limit: 100,
        });
        return new Response(JSON.stringify(withdrawals), {
          headers: corsHeaders,
        });
      }

      case "update_withdrawal": {
        const { withdrawalId, status } = body;
        const withdrawal = await blink.db
          .table("withdrawals")
          .get(withdrawalId);
        if (!withdrawal) {
          return new Response(
            JSON.stringify({ error: "Withdrawal not found" }),
            { status: 404, headers: corsHeaders }
          );
        }

        if (status === "approved" && withdrawal.status === "pending") {
          await blink.db
            .table("withdrawals")
            .update(withdrawalId, {
              status: "approved",
              updatedAt: new Date().toISOString(),
            });

          await blink.db.table("transactions").create({
            userId: withdrawal.userId,
            amount: -Number(withdrawal.amount),
            type: "withdrawal",
            status: "completed",
            description: "Withdrawal approved",
          });
        } else if (status === "rejected") {
          await blink.db
            .table("withdrawals")
            .update(withdrawalId, {
              status: "rejected",
              updatedAt: new Date().toISOString(),
            });

          // Refund balance
          const profiles = await blink.db
            .table("profiles")
            .list({ where: { userId: withdrawal.userId } });
          if (profiles[0]) {
            await blink.db.table("profiles").update(profiles[0].id, {
              balance:
                Number(profiles[0].balance) + Number(withdrawal.amount),
            });
          }
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "list_users": {
        const users = await blink.db.table("profiles").list({
          orderBy: { createdAt: "desc" },
          limit: 200,
        });
        return new Response(JSON.stringify(users), {
          headers: corsHeaders,
        });
      }

      case "update_user": {
        const { targetUserId, updates } = body;
        const profiles = await blink.db
          .table("profiles")
          .list({ where: { userId: targetUserId } });
        if (!profiles[0]) {
          return new Response(
            JSON.stringify({ error: "User profile not found" }),
            { status: 404, headers: corsHeaders }
          );
        }

        // Only allow safe fields to be updated
        const safeUpdates: Record<string, any> = {};
        if (updates.balance !== undefined) safeUpdates.balance = Number(updates.balance);
        if (updates.role !== undefined) safeUpdates.role = String(updates.role);
        if (updates.displayName !== undefined) safeUpdates.displayName = String(updates.displayName);
        if (updates.streakCount !== undefined) safeUpdates.streakCount = Number(updates.streakCount);
        if (updates.isActivated !== undefined) safeUpdates.isActivated = updates.isActivated ? 1 : 0;

        await blink.db.table("profiles").update(profiles[0].id, safeUpdates);
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "promote_to_admin": {
        // Special action: only the ADMIN_EMAIL can promote themselves
        if (auth.email !== ADMIN_EMAIL) {
          return new Response(
            JSON.stringify({ error: "Only the primary admin can self-promote" }),
            { status: 403, headers: corsHeaders }
          );
        }
        const profiles = await blink.db
          .table("profiles")
          .list({ where: { userId: auth.userId } });
        if (profiles[0]) {
          await blink.db.table("profiles").update(profiles[0].id, { role: "admin" });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "list_tasks": {
        const tasks = await blink.db.table("tasks").list({
          orderBy: { createdAt: "desc" },
        });
        return new Response(JSON.stringify(tasks), {
          headers: corsHeaders,
        });
      }

      case "upsert_task": {
        const { task } = body;
        if (task.id) {
          const { id, ...updateData } = task;
          await blink.db.table("tasks").update(id, updateData);
        } else {
          await blink.db.table("tasks").create(task);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "delete_task": {
        const { taskId } = body;
        await blink.db.table("tasks").delete(taskId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "list_store_items": {
        const storeItems = await blink.db.table("store_items").list({
          orderBy: { createdAt: "desc" },
        });
        return new Response(JSON.stringify(storeItems), {
          headers: corsHeaders,
        });
      }

      case "upsert_store_item": {
        const { item } = body;
        if (item.id) {
          const { id, ...updateData } = item;
          await blink.db.table("store_items").update(id, updateData);
        } else {
          await blink.db.table("store_items").create(item);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "delete_store_item": {
        const { itemId: storeItemId } = body;
        await blink.db.table("store_items").delete(storeItemId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: corsHeaders,
        });
      }

      case "list_fraud_flags": {
        const flags = await blink.db.table("fraud_flags").list({
          orderBy: { createdAt: "desc" },
          limit: 100,
        });
        return new Response(JSON.stringify(flags), {
          headers: corsHeaders,
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error: any) {
    console.error("Admin action error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

Deno.serve(handler);
