'use client'
import { useEffect, useState, useCallback } from 'react'
import { appCache } from './cache'

export function useCachedFetch<T>(url: string | null) {
  const cached = url ? appCache.get<T>(url) : undefined
  const [data, setData] = useState<T | undefined>(cached)
  const [loading, setLoading] = useState(!cached)

  const refresh = useCallback(async () => {
    if (!url) return
    const res = await fetch(url)
    if (res.ok) {
      const json = (await res.json()) as T
      appCache.set(url, json)
      setData(json)
    }
    setLoading(false)
  }, [url])

  useEffect(() => {
    setData(url ? appCache.get<T>(url) : undefined)
    setLoading(url ? !appCache.get(url) : false)
    refresh() // stale-while-revalidate: render cache instantly, refetch in background
  }, [url, refresh])

  return { data, loading, refresh }
}
