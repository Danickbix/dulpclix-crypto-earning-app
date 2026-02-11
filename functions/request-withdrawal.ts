import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MIN_WITHDRAWAL = 100;
const MAX_DAILY_WITHDRAWALS = 3;
const COOLDOWN_HOURS = 6;

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blink = createClient({ projectId, secretKey });
    
    // Verify Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    
    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });

    const userId = auth.userId;
    const { amount, address } = await req.json();

    if (!amount || !address) {
      return new Response(JSON.stringify({ error: "Amount and address required" }), { status: 400, headers: corsHeaders });
    }

    if (Number(amount) < MIN_WITHDRAWAL) {
      return new Response(JSON.stringify({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} DULP` }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch Profile
    let userProfile;
    const profiles = await blink.db.table("profiles").list({ where: { userId } });
    if (profiles.length > 0) userProfile = profiles[0];

    if (!userProfile || Number(userProfile.balance) < Number(amount)) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: corsHeaders });
    }

    // 2. Activation & Level Check
    if (!userProfile.isActivated) {
      return new Response(JSON.stringify({ error: "Account activation required for withdrawals" }), { status: 403, headers: corsHeaders });
    }

    const xpProfileSearch = await blink.db.table("xp_profiles").list({ where: { user_id: userId } });
    const currentLevel = xpProfileSearch.length > 0 ? Number(xpProfileSearch[0].level) : 1;

    if (currentLevel < 4) {
      return new Response(JSON.stringify({ error: "Level 4 required for withdrawals" }), { status: 403, headers: corsHeaders });
    }

    // 3. Daily Limit Check
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const dailyCount = await blink.db.table("withdrawals").count({
      where: {
        AND: [
          { userId: userId },
          { createdAt: { gte: todayStart } }
        ]
      }
    });

    if (dailyCount >= MAX_DAILY_WITHDRAWALS) {
      return new Response(JSON.stringify({ error: "Daily withdrawal limit reached" }), { status: 400, headers: corsHeaders });
    }

    // 4. Cooldown Check
    const lastWithdrawal = await blink.db.table("withdrawals").list({
      where: { userId: userId },
      orderBy: { createdAt: "desc" },
      limit: 1
    });

    if (lastWithdrawal.length > 0) {
      const lastTime = new Date(lastWithdrawal[0].createdAt);
      const diffMs = now.getTime() - lastTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < COOLDOWN_HOURS) {
        return new Response(JSON.stringify({ error: `Cooldown active. Please wait ${Math.ceil(COOLDOWN_HOURS - diffHours)} hours.` }), { status: 400, headers: corsHeaders });
      }
    }

    // 5. Process Withdrawal
    const newBalance = Number(userProfile.balance) - Number(amount);

    // Update Balance (Debit)
    await blink.db.table("profiles").update(userProfile.id, {
      balance: newBalance
    });

    // Create Withdrawal Record
    await blink.db.table("withdrawals").create({
      userId,
      amount: Number(amount),
      address,
      status: "pending"
    });

    // Add Transaction Log
    await blink.db.table("transactions").create({
      userId,
      amount: -Number(amount),
      type: "withdrawal",
      description: `Withdrawal request to ${address}`
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Withdrawal request submitted successfully",
      newBalance
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);