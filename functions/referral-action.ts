import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const projectId = Deno.env.get("BLINK_PROJECT_ID");
    const secretKey = Deno.env.get("BLINK_SECRET_KEY");
    if (!projectId || !secretKey) {
      return jsonResponse({ error: "Missing config" }, 500);
    }

    const blink = createClient({ projectId, secretKey });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const userId = auth.userId;
    const body = await req.json();
    const { action, code, displayName, twitterHandle, instagramHandle, tiktokHandle, youtubeHandle, telegramUsername, discordUsername } = body;

    const profiles = await blink.db.table("profiles").list({
      where: { user_id: userId },
    });
    const userProfile = profiles.length > 0 ? profiles[0] : null;

    if (!userProfile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    switch (action) {
      case "get_referral_stats": {
        const referralCode = userProfile.referral_code || userProfile.referralCode;
        if (!referralCode) {
          return jsonResponse({ count: 0, earnings: 0, referralCode: null, referredBy: null, referredUsers: [] });
        }

        const referredUsers = await blink.db.table("profiles").list({
          where: { referred_by: referralCode },
        });

        const referralTx = await blink.db.table("transactions").list({
          where: { user_id: userId, type: "referral" },
        });

        const totalEarnings = referralTx.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        );

        const referredList = referredUsers.map((u: any) => ({
          displayName: u.display_name || u.displayName || "User",
          joinedAt: u.created_at || u.createdAt,
        }));

        return jsonResponse({
          count: referredUsers.length,
          earnings: totalEarnings,
          referralCode,
          referredBy: userProfile.referred_by || userProfile.referredBy || null,
          referredUsers: referredList,
        });
      }

      case "validate_referral_code": {
        if (!code || typeof code !== "string") {
          return jsonResponse({ error: "Code is required" }, 400);
        }

        const upperCode = code.trim().toUpperCase();
        const userRefCode = userProfile.referral_code || userProfile.referralCode;

        if (upperCode === userRefCode) {
          return jsonResponse({ error: "You cannot use your own referral code" }, 400);
        }

        const existingRef = userProfile.referred_by || userProfile.referredBy;
        if (existingRef) {
          return jsonResponse({ error: "You already have a referral code applied" }, 400);
        }

        const referrerProfiles = await blink.db.table("profiles").list({
          where: { referral_code: upperCode },
        });

        if (referrerProfiles.length === 0) {
          return jsonResponse({ error: "Invalid referral code" }, 400);
        }

        return jsonResponse({
          valid: true,
          referrerName: referrerProfiles[0].display_name || referrerProfiles[0].displayName || "User",
        });
      }

      case "apply_referral_code": {
        if (!code || typeof code !== "string") {
          return jsonResponse({ error: "Code is required" }, 400);
        }

        const upperCode = code.trim().toUpperCase();
        const userRefCode = userProfile.referral_code || userProfile.referralCode;

        if (upperCode === userRefCode) {
          return jsonResponse({ error: "You cannot use your own referral code" }, 400);
        }

        const existingRef = userProfile.referred_by || userProfile.referredBy;
        if (existingRef) {
          return jsonResponse({ error: "You already have a referral code applied" }, 400);
        }

        const referrerProfiles = await blink.db.table("profiles").list({
          where: { referral_code: upperCode },
        });

        if (referrerProfiles.length === 0) {
          return jsonResponse({ error: "Invalid referral code" }, 400);
        }

        await blink.db.table("profiles").update(userProfile.id, {
          referred_by: upperCode,
        });

        return jsonResponse({
          ok: true,
          message: "Referral code applied successfully!",
          referrerName: referrerProfiles[0].display_name || referrerProfiles[0].displayName || "User",
        });
      }

      case "update_profile": {
        const updates: Record<string, string> = {};
        if (displayName !== undefined) updates.display_name = displayName;
        if (twitterHandle !== undefined) updates.twitter_handle = twitterHandle;
        if (instagramHandle !== undefined) updates.instagram_handle = instagramHandle;
        if (tiktokHandle !== undefined) updates.tiktok_handle = tiktokHandle;
        if (youtubeHandle !== undefined) updates.youtube_handle = youtubeHandle;
        if (telegramUsername !== undefined) updates.telegram_username = telegramUsername;
        if (discordUsername !== undefined) updates.discord_username = discordUsername;

        if (Object.keys(updates).length === 0) {
          return jsonResponse({ error: "No updates provided" }, 400);
        }

        await blink.db.table("profiles").update(userProfile.id, updates);

        return jsonResponse({ ok: true, message: "Profile updated successfully" });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("Referral action error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

Deno.serve(handler);
