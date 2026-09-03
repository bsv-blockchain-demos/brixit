import * as React from "react"
import { MOBILE_BREAKPOINT } from "../lib/breakpoints"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Matches `(max-width: {px}px)`. Was copy-pasted into the filters bar and the
 * detail modal; the readings browser needed a third, so it lives here now.
 */
export function useMaxWidth(px: number): boolean {
  const query = `(max-width: ${px}px)`
  const [matches, setMatches] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  )
  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}
