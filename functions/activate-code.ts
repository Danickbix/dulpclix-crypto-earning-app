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
    const { code } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: "Code required" }), { status: 400, headers: corsHeaders });
    }

    // 1. Check if user already activated
    const existingActivation = await blink.db.table("user_activations").get(userId);
    if (existingActivation) {
      return new Response(JSON.stringify({ error: "Account already activated" }), { status: 400, headers: corsHeaders });
    }

    // 2. Validate Code
    const codes = await blink.db.table("activation_codes").list({
      where: { code: code, is_active: 1 }
    });

    if (codes.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid activation code" }), { status: 404, headers: corsHeaders });
    }

    const ac = codes[0];

    // Check expiration
    if (ac.expires_at && new Date(ac.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: corsHeaders });
    }

    // Check usage
    if (Number(ac.current_uses) >= Number(ac.max_uses)) {
      return new Response(JSON.stringify({ error: "Code usage limit reached" }), { status: 400, headers: corsHeaders });
    }

    // 3. Perform Activation
    // Update code usage
    await blink.db.table("activation_codes").update(ac.id, {
      current_uses: Number(ac.current_uses) + 1
    });

    // Create user activation record
    await blink.db.table("user_activations").create({
      user_id: userId,
      activation_code_id: ac.id,
      activated_at: new Date().toISOString()
    });

    // Update profile status
    const profileSearch = await blink.db.table("profiles").list({ where: { userId } });
    if (profileSearch.length > 0) {
      await blink.db.table("profiles").update(profileSearch[0].id, {
        is_activated: 1
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "Account successfully activated!" }), {
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
