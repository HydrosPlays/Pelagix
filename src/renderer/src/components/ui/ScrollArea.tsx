import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentPropsWithoutRef, type Ref } from 'react'
import { cx } from './cx'
import './ScrollArea.css'

const ScrollParentContext = createContext<HTMLElement | null>(null)

/** The nearest `ScrollArea` element above this component (the app's main region for a routed page), or null. */
export function useScrollParent(): HTMLElement | null {
  return useContext(ScrollParentContext)
}

export interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  /** Scroll direction. Default "y". */
  axis?: 'y' | 'x' | 'both'
  /** Fade a soft edge in at the top / bottom while there is more content that way. Default false. */
  edges?: boolean
  /** Receives the scrolling element. */
  scrollRef?: Ref<HTMLDivElement>
  /** Class for the scrolling element itself (`className` goes on the outer frame). */
  viewportClassName?: string
}

/**
 * A scroll container with the app's scrollbar styling. It registers itself as the scroll parent
 * for descendants (`useScrollParent`), which is what `VirtualGrid scroll="page"` virtualises against.
 */
export function ScrollArea({ axis = 'y', edges = false, scrollRef, className, viewportClassName, children, ...rest }: ScrollAreaProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      setElement(node)
      if (typeof scrollRef === 'function') scrollRef(node)
      else if (scrollRef) scrollRef.current = node
    },
    [scrollRef]
  )

  useEffect(() => {
    if (!edges || !element) return
    const frame = frameRef.current
    if (!frame) return
    let raf = 0
    const update = (): void => {
      raf = 0
      frame.dataset.top = element.scrollTop > 2 ? 'true' : 'false'
      frame.dataset.bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 2 ? 'true' : 'false'
    }
    const schedule = (): void => {
      if (raf === 0) raf = requestAnimationFrame(update)
    }
    update()
    element.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf)
      element.removeEventListener('scroll', schedule)
      observer.disconnect()
    }
  }, [edges, element])

  return (
    <div ref={frameRef} className={cx('ui-scroll', edges && 'ui-scroll--edges', className)}>
      <div ref={attach} className={cx('ui-scroll__viewport', `ui-scroll__viewport--${axis}`, viewportClassName)} {...rest}>
        <ScrollParentContext.Provider value={element}>{children}</ScrollParentContext.Provider>
      </div>
    </div>
  )
}
