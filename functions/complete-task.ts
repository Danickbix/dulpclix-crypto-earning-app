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
    
    // 1. Verify Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    
    const auth = await blink.auth.verifyToken(authHeader);
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const userId = auth.userId;
    const { taskId } = await req.json();

    if (!taskId) {
      return new Response(JSON.stringify({ error: "Task ID required" }), { status: 400, headers: corsHeaders });
    }

    // 2. Fetch Task Data
    const task = await blink.db.table("tasks").get(taskId);
    if (!task || Number(task.is_active) === 0) {
      return new Response(JSON.stringify({ error: "Task not found or inactive" }), { status: 404, headers: corsHeaders });
    }

    // 3. Validation Logic
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Check daily completion limit
    const dailyCompletions = await blink.db.table("user_tasks").count({
      where: {
        AND: [
          { userId: userId },
          { taskId: taskId },
          { completedAt: { gte: todayStart } }
        ]
      }
    });

    if (dailyCompletions >= Number(task.max_completions_per_day)) {
      return new Response(JSON.stringify({ error: "Daily limit reached for this task" }), { status: 400, headers: corsHeaders });
    }

    // Check cooldown
    if (Number(task.cooldown_minutes) > 0) {
      const lastCompletion = await blink.db.table("user_tasks").list({
        where: { userId: userId, taskId: taskId },
        orderBy: { completedAt: "desc" },
        limit: 1
      });

      if (lastCompletion.length > 0) {
        const lastTime = new Date(lastCompletion[0].completedAt);
        const diffMs = now.getTime() - lastTime.getTime();
        const diffMins = diffMs / (1000 * 60);
        
        if (diffMins < Number(task.cooldown_minutes)) {
          return new Response(JSON.stringify({ error: "Task in cooldown" }), { status: 400, headers: corsHeaders });
        }
      }
    }

    // 4. Issue Reward - find profile by userId
    const profiles = await blink.db.table("profiles").list({ where: { userId } });
    const userProfile = profiles.length > 0 ? profiles[0] : null;

    if (!userProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });
    }

    // Emission Check
    const MAX_DAILY_EMISSION = 100000;
    const today = new Date().toISOString().split('T')[0];
    let emission = await blink.db.table("daily_emissions").get(today);
    if (!emission) {
      emission = await blink.db.table("daily_emissions").create({ date: today, total_emitted: 0 });
    }

    if (Number(emission.total_emitted) >= MAX_DAILY_EMISSION) {
      return new Response(JSON.stringify({ error: "Daily token emission limit reached. Try again tomorrow." }), { status: 429, headers: corsHeaders });
    }

    // 5. XP & Level System
    const XP_PER_TASK = 10;
    let xpProfile = await blink.db.table("xp_profiles").get(userId);
    if (!xpProfile) {
      xpProfile = await blink.db.table("xp_profiles").create({ user_id: userId, xp: 0, level: 1 });
    }

    const currentXp = Number(xpProfile.xp) + XP_PER_TASK;
    let currentLevel = Number(xpProfile.level);
    
    // Level Formula: required_xp = 100 * level^1.5
    const getNextLevelXp = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.5));
    let nextLevelXp = getNextLevelXp(currentLevel);

    let leveledUp = false;
    while (currentXp >= nextLevelXp) {
      currentLevel++;
      nextLevelXp = getNextLevelXp(currentLevel);
      leveledUp = true;
    }

    // Update XP Profile
    await blink.db.table("xp_profiles").update(userId, {
      xp: currentXp,
      level: currentLevel,
      updated_at: now.toISOString()
    });

    const rewardAmount = Number(task.reward_amount);
    
    // Update Emission
    await blink.db.table("daily_emissions").update(today, {
      total_emitted: Number(emission.total_emitted) + rewardAmount
    });

    const newBalance = (Number(userProfile.balance) || 0) + rewardAmount;

    // Transactional updates (simulated as individual calls since SQL batch is restricted)
    // In a real environment, we'd want atomicity.
    
    // Create user_task record
    await blink.db.table("user_tasks").create({
      userId,
      taskId,
      status: "completed",
      completedAt: now.toISOString()
    });

    // Create transaction record
    await blink.db.table("transactions").create({
      userId,
      amount: rewardAmount,
      type: "earn",
      description: `Completed task: ${task.title}`
    });

    // Update profile
    const profileUpdate: any = { balance: newBalance };
    if (task.type === "checkin") {
      profileUpdate.streakCount = (Number(userProfile.streakCount) || 0) + 1;
      profileUpdate.lastStreakAt = now.toISOString();
    }
    
    await blink.db.table("profiles").update(userProfile.id, profileUpdate);

    // 6. Referral Commission (10%)
    // SDK returns camelCase, but raw DB may use snake_case - handle both
    const referredByCode = userProfile.referredBy || userProfile.referred_by;
    if (referredByCode) {
      const referrers = await blink.db.table("profiles").list({
        where: { referralCode: referredByCode }
      });
      
      const referrer = referrers[0];
      if (referrer) {
        const commission = Math.floor(rewardAmount * 0.1);
        if (commission > 0) {
          const referrerUserId = referrer.userId || referrer.user_id;
          const newReferrerBalance = (Number(referrer.balance) || 0) + commission;
          
          await blink.db.table("profiles").update(referrer.id, {
            balance: newReferrerBalance
          });

          await blink.db.table("transactions").create({
            userId: referrerUserId,
            amount: commission,
            type: "referral",
            description: `Referral commission from ${userProfile.displayName || userProfile.display_name || 'a friend'}`
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      reward: rewardAmount, 
      newBalance: newBalance,
      xpGained: XP_PER_TASK,
      currentLevel,
      leveledUp
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