import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gcnefnqtjxtqbhynyoxe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  db: { schema: 'public' },
  global: {
    fetch: async (url, options = {}) => {
      const MAX_RETRIES = 3
      let lastError
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const response = await fetch(url, options)
          return response
        } catch (err) {
          lastError = err
          if (i < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        }
      }
      throw lastError
    }
  }
})
