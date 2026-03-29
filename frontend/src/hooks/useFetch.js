import { useState, useEffect, useCallback } from "react";

export function useFetch(url, refreshInterval = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const doFetch = useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        setLastUpdated(new Date());
      })
      .catch(() => setLoading(false));
  }, [url]);

  useEffect(() => { doFetch(); }, [doFetch]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(doFetch, refreshInterval);
    return () => clearInterval(id);
  }, [doFetch, refreshInterval]);

  return { data, loading, lastUpdated, refresh: doFetch };
}
