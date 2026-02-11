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
    const { gameType } = await req.json();

    if (!gameType) return new Response(JSON.stringify({ error: "Game type required" }), { status: 400, headers: corsHeaders });

    // 1. Level & Activation Check
    const profileSearch = await blink.db.table("profiles").list({ where: { userId } });
    if (profileSearch.length === 0) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });
    const profile = profileSearch[0];

    const xpProfileSearch = await blink.db.table("xp_profiles").list({ where: { user_id: userId } });
    const currentLevel = xpProfileSearch.length > 0 ? Number(xpProfileSearch[0].level) : 1;

    // Advanced games require activation
    const advancedGames = ["spin_wheel", "puzzle_game", "reaction_sprint"];
    if (advancedGames.includes(gameType) && !profile.isActivated) {
      return new Response(JSON.stringify({ error: "Activation required for advanced games" }), { status: 403, headers: corsHeaders });
    }

    // Level Gates
    const levelGates: Record<string, number> = {
      "tap_race": 1,
      "spin_wheel": 2,
      "puzzle_game": 3,
      "reaction_sprint": 4
    };

    if (levelGates[gameType] && currentLevel < levelGates[gameType]) {
      return new Response(JSON.stringify({ error: `Level ${levelGates[gameType]} required for this game` }), { status: 403, headers: corsHeaders });
    }

    // 2. Check for existing uncompleted sessions to prevent spam
    const existingSessions = await blink.db.table("game_sessions").list({
      where: { userId: userId, isCompleted: 0 },
      limit: 1
    });

    if (existingSessions.length > 0) {
      // If a session exists and is older than 1 minute, we can let them start a new one
      const startTime = new Date(existingSessions[0].startTime);
      const now = new Date();
      if ((now.getTime() - startTime.getTime()) < 60000) {
        return new Response(JSON.stringify({ 
          error: "Existing session in progress", 
          sessionId: existingSessions[0].id 
        }), { status: 400, headers: corsHeaders });
      }
      
      // Mark old session as completed but with 0 score (abandoned)
      await blink.db.table("game_sessions").update(existingSessions[0].id, { isCompleted: 1 });
    }

    // Create new session
    const session = await blink.db.table("game_sessions").create({
      userId,
      gameType,
      startTime: new Date().toISOString(),
      isCompleted: 0
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      sessionId: session.id 
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