import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  raceId: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { raceId }: RequestBody = await req.json();

    const { data: participants, error: participantsError } = await supabase
      .from('race_participants')
      .select('id, user_id')
      .eq('race_id', raceId)
      .eq('status', 'joined');

    if (participantsError) throw participantsError;

    if (!participants || participants.length < 2) {
      throw new Error('Need at least 2 participants');
    }

    const userIds = participants.map(p => p.user_id);

    for (const participant of participants) {
      const otherUsers = userIds.filter(id => id !== participant.user_id);
      const shuffledOthers = shuffleArray(otherUsers);
      const sequence = [...shuffledOthers, participant.user_id];

      await supabase
        .from('race_participants')
        .update({
          checkpoint_sequence: sequence,
          current_checkpoint_index: 0,
          checkpoints_visited: 0,
          current_target_user_id: sequence[0],
        })
        .eq('id', participant.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Checkpoint sequences generated' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
