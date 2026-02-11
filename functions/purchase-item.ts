import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");

    if (!projectId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Missing config" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const blink = createClient({ projectId, secretKey });

    // Verify Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = auth.userId;
    const { itemId } = await req.json();

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: "Item ID required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get the store item
    const item = await blink.db.table("store_items").get(itemId);
    if (!item || Number(item.isActive || item.is_active) === 0) {
      return new Response(
        JSON.stringify({ error: "Item not found or unavailable" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get user profile
    const profiles = await blink.db.table("profiles").list({
      where: { userId },
    });
    const profile = profiles[0];
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const price = Number(item.price);
    const currentBalance = Number(profile.balance) || 0;

    if (currentBalance < price) {
      return new Response(
        JSON.stringify({ error: "Insufficient balance" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Deduct balance
    const newBalance = currentBalance - price;
    await blink.db.table("profiles").update(profile.id, {
      balance: newBalance,
    });

    // Create transaction record
    await blink.db.table("transactions").create({
      userId,
      amount: -price,
      type: "purchase",
      description: `Purchased: ${item.name || item.title}`,
    });

    // Apply boost if applicable
    const itemType = item.type || item.category;
    if (itemType === "booster" || itemType === "powerup") {
      const durationHours = Number(item.durationHours || item.duration_hours) || 24;
      const expiresAt = new Date(
        Date.now() + durationHours * 60 * 60 * 1000
      ).toISOString();

      await blink.db.table("user_boosts").create({
        userId,
        itemId: item.id,
        expiresAt,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        newBalance,
        item: item.name || item.title,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Purchase error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

Deno.serve(handler);
