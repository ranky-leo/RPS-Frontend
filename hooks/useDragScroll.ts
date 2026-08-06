"use client";

import { useCallback, useRef } from "react";

type DragState = {
  active: boolean;
  moved: boolean;
  startX: number;
  scrollLeft: number;
};

const DRAG_THRESHOLD_PX = 6;

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const dragRef = useRef<DragState>({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
  });

  const endDrag = useCallback((pointerId?: number) => {
    const element = ref.current;
    if (!element) {
      return;
    }

    dragRef.current.active = false;
    element.classList.remove("is-dragging");

    if (pointerId !== undefined && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<T>) => {
    const element = ref.current;
    if (!element || event.button !== 0) {
      return;
    }

    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
    };
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const element = ref.current;
    if (!element || !dragRef.current.active) {
      return;
    }

    const delta = event.clientX - dragRef.current.startX;
    if (!dragRef.current.moved) {
      if (Math.abs(delta) <= DRAG_THRESHOLD_PX) {
        return;
      }

      dragRef.current.moved = true;
      element.classList.add("is-dragging");
      element.setPointerCapture(event.pointerId);
    }

    element.scrollLeft = dragRef.current.scrollLeft - delta;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<T>) => {
      endDrag(event.pointerId);
    },
    [endDrag],
  );

  const onPointerLeave = useCallback(
    (event: React.PointerEvent<T>) => {
      if (dragRef.current.active && dragRef.current.moved) {
        endDrag(event.pointerId);
      }
    },
    [endDrag],
  );

  const shouldIgnoreClick = useCallback(() => {
    if (!dragRef.current.moved) {
      return false;
    }

    dragRef.current.moved = false;
    return true;
  }, []);

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    shouldIgnoreClick,
  };
}
