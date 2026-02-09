/**
 * Supabase Edge Function: send-copier-notification
 * 
 * Sends email notifications for copier events via Resend.
 * Called from the desktop app when significant copier events occur.
 * 
 * Environment variables required:
 *   RESEND_API_KEY  - Resend API key
 *   FROM_EMAIL      - Sender email (e.g., notifications@hedgeedge.com)
 * 
 * POST body:
 * {
 *   "user_id": "uuid",
 *   "event_type": "copy_failure" | "protection_triggered" | "circuit_breaker" | "daily_summary",
 *   "data": { ... event-specific payload ... }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@hedgeedge.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface NotificationRequest {
  user_id: string;
  event_type: 'copy_failure' | 'protection_triggered' | 'circuit_breaker' | 'daily_summary';
  data: Record<string, unknown>;
}

serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: NotificationRequest = await req.json();
    const { user_id, event_type, data } = body;

    if (!user_id || !event_type) {
      return new Response(JSON.stringify({ error: 'user_id and event_type are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Check user's notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (prefsError || !prefs) {
      return new Response(JSON.stringify({ sent: false, reason: 'No notification preferences found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!prefs.email_enabled) {
      return new Response(JSON.stringify({ sent: false, reason: 'Email notifications disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this event type should trigger a notification
    const shouldNotify = checkEventPreference(prefs, event_type);
    if (!shouldNotify) {
      return new Response(JSON.stringify({ sent: false, reason: 'Event type not enabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Throttle check - don't send more than 1 email per min_interval_seconds
    const { data: recentSends } = await supabase
      .from('notification_send_log')
      .select('sent_at')
      .eq('user_id', user_id)
      .gte('sent_at', new Date(Date.now() - (prefs.min_interval_seconds || 60) * 1000).toISOString())
      .limit(1);

    if (recentSends && recentSends.length > 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'Throttled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single();

    const recipientEmail = prefs.email_address || profile?.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ sent: false, reason: 'No email address' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Build email content
    const { subject, html } = buildEmailContent(event_type, data, profile?.full_name);

    // 5. Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('Resend API error:', errText);
      return new Response(JSON.stringify({ sent: false, reason: 'Email send failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Log the send
    await supabase.from('notification_send_log').insert({
      user_id,
      notification_type: event_type,
    });

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function checkEventPreference(
  prefs: Record<string, unknown>,
  eventType: string,
): boolean {
  switch (eventType) {
    case 'copy_failure':
      return !!prefs.notify_on_copy_failure;
    case 'protection_triggered':
      return !!prefs.notify_on_protection_triggered;
    case 'circuit_breaker':
      return !!prefs.notify_on_circuit_breaker;
    case 'daily_summary':
      return !!prefs.notify_on_daily_summary;
    default:
      return false;
  }
}

function buildEmailContent(
  eventType: string,
  data: Record<string, unknown>,
  userName?: string,
): { subject: string; html: string } {
  const greeting = userName ? `Hi ${userName},` : 'Hi,';

  switch (eventType) {
    case 'copy_failure': {
      const symbol = (data.symbol as string) || 'Unknown';
      const follower = (data.followerName as string) || 'Unknown account';
      const error = (data.error as string) || 'Unknown error';
      return {
        subject: `⚠️ Trade Copy Failed - ${symbol}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Trade Copy Failed</h2>
            <p>${greeting}</p>
            <p>A trade copy to <strong>${follower}</strong> has failed:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Symbol</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${symbol}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Action</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${(data.action as string) || '-'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Volume</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.volume || '-'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Error</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ef4444;">${error}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px;">Sent by HedgeEdge Copier</p>
          </div>
        `,
      };
    }

    case 'protection_triggered': {
      const follower = (data.followerName as string) || 'Unknown account';
      const mode = (data.mode as string) || 'threshold';
      const value = data.value ?? '-';
      return {
        subject: `🛡️ Account Protection Triggered - ${follower}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Account Protection Triggered</h2>
            <p>${greeting}</p>
            <p>Account protection has been triggered for <strong>${follower}</strong>.</p>
            <p>Mode: <strong>${mode}</strong>, Current value: <strong>${value}</strong></p>
            <p>All copying to this account has been <strong>paused</strong>. Please review and re-enable manually.</p>
            <p style="color: #6b7280; font-size: 12px;">Sent by HedgeEdge Copier</p>
          </div>
        `,
      };
    }

    case 'circuit_breaker': {
      const follower = (data.followerName as string) || 'Unknown account';
      const failures = data.failures ?? 3;
      return {
        subject: `🔴 Circuit Breaker Tripped - ${follower}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Circuit Breaker Tripped</h2>
            <p>${greeting}</p>
            <p>The circuit breaker for <strong>${follower}</strong> has been tripped after <strong>${failures}</strong> consecutive failures.</p>
            <p>Copying to this follower is <strong>paused</strong> until you reset it from the Trade Copier page.</p>
            <p style="color: #6b7280; font-size: 12px;">Sent by HedgeEdge Copier</p>
          </div>
        `,
      };
    }

    case 'daily_summary': {
      const stats = data as Record<string, unknown>;
      return {
        subject: `📊 Daily Copier Summary`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Daily Copier Summary</h2>
            <p>${greeting}</p>
            <p>Here's your copier activity for today:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Trades Copied</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${stats.tradesToday ?? 0}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Success Rate</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${stats.successRate ?? '-'}%</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Avg Latency</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${stats.avgLatency ?? '-'}ms</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Active Groups</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${stats.activeGroups ?? 0}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Failures</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${(stats.failures as number) > 0 ? '#ef4444' : '#22c55e'};">${stats.failures ?? 0}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px;">Sent by HedgeEdge Copier</p>
          </div>
        `,
      };
    }

    default:
      return {
        subject: 'HedgeEdge Copier Notification',
        html: `<p>${greeting}</p><p>You have a new copier notification.</p>`,
      };
  }
}
