import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MAX_TAP_SPEED = 12; // taps per second
const GAME_DURATION = 10; // seconds

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
    const { sessionId, score } = await req.json();

    if (!sessionId || score === undefined) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch Session
    const session = await blink.db.table("game_sessions").get(sessionId);
    if (!session || Number(session.isCompleted) === 1 || session.userId !== userId) {
      return new Response(JSON.stringify({ error: "Invalid or already completed session" }), { status: 400, headers: corsHeaders });
    }

    // 2. Validate Duration
    const now = new Date();
    const startTime = new Date(session.startTime);
    const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;

    // Minimum 9 seconds for a 10-second game (allow slight network latency)
    if (elapsedSeconds < 9) {
      return new Response(JSON.stringify({ error: "Game finished too early (Anti-Cheat)" }), { status: 400, headers: corsHeaders });
    }

    // 3. Validate Score (Anti-Bot)
    // For Tap Race, score is tap count.
    const maxPossibleScore = elapsedSeconds * MAX_TAP_SPEED;
    if (score > maxPossibleScore) {
      return new Response(JSON.stringify({ error: "Score too high (Anti-Bot)" }), { status: 400, headers: corsHeaders });
    }

    // 4. Calculate Reward
    const reward = Math.floor(score / 5); // 1 token per 5 taps

    // 5. Update Database
    // Mark session as completed
    await blink.db.table("game_sessions").update(sessionId, {
      isCompleted: 1,
      score: score,
      rewardIssued: reward
    });

    if (reward > 0) {
      // Fetch Profile
      let userProfile;
      const profiles = await blink.db.table("profiles").list({ where: { userId } });
      if (profiles.length > 0) userProfile = profiles[0];

      if (userProfile) {
        const newBalance = (Number(userProfile.balance) || 0) + reward;
        
        // Update Balance
        await blink.db.table("profiles").update(userProfile.id, {
          balance: newBalance
        });

        // Add Transaction
        await blink.db.table("transactions").create({
          userId,
          amount: reward,
          type: "earn",
          description: `Tap Race score: ${score}`
        });

        // Update Leaderboard
        const entries = await blink.db.table("leaderboard_entries").list({
          where: { userId: userId, period: "all_time" }
        });
        
        if (entries.length > 0) {
          await blink.db.table("leaderboard_entries").update(entries[0].id, {
            score: Number(entries[0].score) + score,
            updatedAt: new Date().toISOString()
          });
        } else {
          await blink.db.table("leaderboard_entries").create({
            userId: userId,
            score: score,
            period: "all_time"
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      reward, 
      score 
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
