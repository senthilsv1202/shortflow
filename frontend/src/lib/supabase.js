import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const supabase = createClient(url, key, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'implicit',
  }
})

export const db = {
  async getShorts(userId, filters={}) {
    let q = supabase.from('shorts').select('*').eq('user_id',userId).order('created_at',{ascending:false})
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.channel_id) q = q.eq('channel_id', filters.channel_id)
    const { data, error } = await q
    if (error) throw error
    return data || []
  },
  async createShort(d) {
    const { data, error } = await supabase.from('shorts').insert(d).select().single()
    if (error) throw error; return data
  },
  async updateShort(id, updates) {
    const { data, error } = await supabase.from('shorts').update(updates).eq('id',id).select().single()
    if (error) throw error; return data
  },
  async deleteShort(id) {
    const { error } = await supabase.from('shorts').delete().eq('id',id)
    if (error) throw error
  },
  async getChannels(userId) {
    const { data, error } = await supabase.from('channels').select('*').eq('user_id',userId)
    if (error) throw error; return data || []
  },
  async getAnalytics(userId, days=30) {
    const from = new Date(Date.now()-days*86400000).toISOString().split('T')[0]
    const { data, error } = await supabase.from('analytics').select('*').eq('user_id',userId).gte('date',from).order('date')
    if (error) throw error; return data || []
  },
  async getSchedule(userId) {
    const { data, error } = await supabase.from('scheduled_posts')
      .select('*, shorts(*), channels(*)')
      .eq('user_id',userId)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
    if (error) throw error; return data || []
  },
}
