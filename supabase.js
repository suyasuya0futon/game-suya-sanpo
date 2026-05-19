import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://tdzhpfwzqedqioqvflrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkemhwZnd6cWVkcWlvcXZmbHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjgzMDAsImV4cCI6MjA5MjQwNDMwMH0.Pm4QJVZih5JRcTKKHL707ItsHTSZU_KxHsdGmwxZyJM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOKEN_STORAGE_KEY = "oyasumi-sanpo-score-tokens";

export async function submitScore({ score, loopCount }) {
  const { data, error } = await supabase.rpc("submit_score", {
    p_score: score,
    p_loop_count: loopCount
  });
  if (error) throw error;
  const row = data && data[0];
  if (!row || !row.inserted) {
    return null;
  }
  saveToken(row.id, row.token);
  return { id: row.id, createdAt: row.created_at };
}

export async function getMyRank({ id, score, loopCount, createdAt }) {
  const { data, error } = await supabase.rpc("get_my_rank", {
    p_id: id,
    p_score: score,
    p_loop_count: loopCount,
    p_created_at: createdAt
  });
  if (error) throw error;
  return data;
}

export async function getTopRanking(limit = 10) {
  const { data, error } = await supabase
    .from("public_rankings")
    .select("id, rank, score, loop_count, name")
    .order("rank", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function setName(scoreId, name) {
  const token = loadToken(scoreId);
  if (!token) throw new Error("token not found");
  const { error } = await supabase.rpc("set_score_name", {
    p_id: scoreId,
    p_token: token,
    p_name: name
  });
  if (error) throw error;
}

const memoryTokens = new Map();

function saveToken(id, token) {
  memoryTokens.set(id, token);
  try {
    const map = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || "{}");
    map[id] = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 不可でもメモリ側で保持されているのでセッション中は名前登録可能
  }
}

function loadToken(id) {
  if (memoryTokens.has(id)) return memoryTokens.get(id);
  try {
    const map = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || "{}");
    return map[id];
  } catch {
    return null;
  }
}
