import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const blink = createClient({
    projectId: Deno.env.get("BLINK_PROJECT_ID")!,
    secretKey: Deno.env.get("BLINK_SECRET_KEY")!,
  });

  // Verify admin access via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const user = await blink.auth.me(authHeader);
  const ADMIN_EMAIL = "Danickbix@gmail.com";

  if (!user || user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "get_stats": {
        const totalUsers = await blink.db.table("profiles").count();
        const pendingWithdrawals = await blink.db.table("withdrawals").count({ where: { status: "pending" } });
        const today = new Date().toISOString().split('T')[0];
        const todayEmission = await blink.db.table("daily_emissions").get(today);
        
        return new Response(JSON.stringify({
          totalUsers,
          pendingWithdrawals,
          dailyEmission: todayEmission?.total_emitted || 0
        }), { headers: corsHeaders });
      }

      case "list_withdrawals": {
        const withdrawals = await blink.db.table("withdrawals").list({
          orderBy: { createdAt: "desc" },
          limit: 100
        });
        return new Response(JSON.stringify(withdrawals), { headers: corsHeaders });
      }

      case "update_withdrawal": {
        const { withdrawalId, status } = body;
        const withdrawal = await blink.db.table("withdrawals").get(withdrawalId);
        if (!withdrawal) throw new Error("Withdrawal not found");

        if (status === "approved" && withdrawal.status === "pending") {
          await blink.db.table("withdrawals").update(withdrawalId, { status: "approved", updated_at: new Date().toISOString() });
          
          await blink.db.table("transactions").create({
            userId: withdrawal.userId,
            amount: -withdrawal.amount,
            type: "withdrawal",
            status: "completed",
            description: "Withdrawal approved"
          });
        } else if (status === "rejected") {
          await blink.db.table("withdrawals").update(withdrawalId, { status: "rejected", updated_at: new Date().toISOString() });
          
          const profiles = await blink.db.table("profiles").list({ where: { userId: withdrawal.userId } });
          if (profiles[0]) {
            await blink.db.table("profiles").update(profiles[0].id, {
              balance: Number(profiles[0].balance) + Number(withdrawal.amount)
            });
          }
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      case "list_users": {
        const users = await blink.db.table("profiles").list({
          orderBy: { created_at: "desc" },
          limit: 100
        });
        return new Response(JSON.stringify(users), { headers: corsHeaders });
      }

      case "update_user": {
        const { targetUserId, updates } = body;
        const profiles = await blink.db.table("profiles").list({ where: { userId: targetUserId } });
        if (!profiles[0]) throw new Error("User not found");
        
        await blink.db.table("profiles").update(profiles[0].id, updates);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      case "list_tasks": {
        const tasks = await blink.db.table("tasks").list({
          orderBy: { created_at: "desc" }
        });
        return new Response(JSON.stringify(tasks), { headers: corsHeaders });
      }

      case "upsert_task": {
        const { task } = body;
        if (task.id) {
          await blink.db.table("tasks").update(task.id, task);
        } else {
          await blink.db.table("tasks").create(task);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      case "delete_task": {
        const { taskId } = body;
        await blink.db.table("tasks").delete(taskId);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}

Deno.serve(handler);
