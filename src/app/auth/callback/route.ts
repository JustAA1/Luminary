import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Check if user is new (redirect to onboarding)
            const { data: { user } } = await supabase.auth.getUser();
            const isNewUser = user?.created_at &&
                (Date.now() - new Date(user.created_at).getTime()) < 60000; // created within last minute

            const redirectTo = isNewUser ? "/onboarding" : next;
            return NextResponse.redirect(`${origin}${redirectTo}`);
        }
    }

    // Auth code exchange failed — redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
