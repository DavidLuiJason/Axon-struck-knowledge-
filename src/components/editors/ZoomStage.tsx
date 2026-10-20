import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createGestureState, reduceGesture, type GestureEvent, type GestureState } from '../../tools/imageEdit/gesture';
import { fitView, refitKeepingCentre, type ViewSize, type ViewState } from '../../tools/imageEdit/viewTransform';

export interface ZoomStageProps {
  pictureWidth: number;
  pictureHeight: number;
  enabled?: boolean;
  resetKey: string | number;
  onToggleFull: () => void;
  onViewCommit?: (view: ViewState) => void;
  className?: string;
  children: React.ReactNode;
}

/** Touch-only interaction shell; it never draws or changes the canvas pixels. */
export const ZoomStage: React.FC<ZoomStageProps> = ({
  pictureWidth, pictureHeight, enabled = true, resetKey, onToggleFull, onViewCommit, className = '', children,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ scale: 1, tx: 0, ty: 0 });
  const gestureRef = useRef<GestureState | null>(null);
  const stageSizeRef = useRef<ViewSize>({ width: 0, height: 0 });
  const pictureSizeRef = useRef<ViewSize>({ width: pictureWidth, height: pictureHeight });
  const frameRef = useRef<number | null>(null);
  const onToggleRef = useRef(onToggleFull);
  const onCommitRef = useRef(onViewCommit);
  onToggleRef.current = onToggleFull;
  onCommitRef.current = onViewCommit;
  pictureSizeRef.current = { width: pictureWidth, height: pictureHeight };

  const writeTransform = useCallback(() => {
    frameRef.current = null;
    const element = pictureRef.current;
    const stage = stageSizeRef.current;
    const picture = pictureSizeRef.current;
    if (!element || stage.width <= 0 || stage.height <= 0 || picture.width <= 0 || picture.height <= 0) return;
    const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
    const view = viewRef.current;
    element.style.transform = `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${fit * view.scale})`;
  }, []);
  const scheduleTransform = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(writeTransform);
  }, [writeTransform]);

  const resetToFit = useCallback(() => {
    const stage = stageSizeRef.current;
    const picture = pictureSizeRef.current;
    if (stage.width <= 0 || stage.height <= 0 || picture.width <= 0 || picture.height <= 0) return;
    const result = fitView(stage, picture);
    if (result.ok === false) return;
    viewRef.current = result.value;
    const gesture = createGestureState(result.value, stage, picture);
    gestureRef.current = gesture.ok === true ? gesture.state : null;
    scheduleTransform();
    onCommitRef.current?.(result.value);
  }, [scheduleTransform]);

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const updateSize = (width: number, height: number) => {
      if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return;
      const oldStage = stageSizeRef.current;
      const nextStage = { width, height };
      stageSizeRef.current = nextStage;
      const picture = pictureSizeRef.current;
      if (oldStage.width > 0 && oldStage.height > 0 && picture.width > 0 && picture.height > 0) {
        const resized = refitKeepingCentre(viewRef.current, oldStage, picture, nextStage, picture);
        if (resized.ok) viewRef.current = resized.value;
        else {
          const fit = fitView(nextStage, picture);
          if (fit.ok) viewRef.current = fit.value;
        }
      } else {
        const fit = fitView(nextStage, picture);
        if (fit.ok) viewRef.current = fit.value;
      }
      const created = createGestureState(viewRef.current, nextStage, picture);
      gestureRef.current = created.ok === true ? created.state : null;
      scheduleTransform();
    };
    updateSize(element.clientWidth, element.clientHeight);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
        })
      : null;
    observer?.observe(element);
    const onResize = () => updateSize(element.clientWidth, element.clientHeight);
    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [scheduleTransform]);

  useLayoutEffect(() => {
    resetToFit();
  }, [resetKey, pictureWidth, pictureHeight, resetToFit]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const dispatch = useCallback((event: GestureEvent, commit = false) => {
    const current = gestureRef.current;
    if (!current) return;
    const result = reduceGesture(current, event);
    if (result.ok === false) return;
    gestureRef.current = result.state;
    viewRef.current = result.state.view;
    scheduleTransform();
    if (result.effects.includes('toggle-full')) onToggleRef.current();
    if (commit) onCommitRef.current?.(result.state.view);
  }, [scheduleTransform]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !gestureRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // The first contact must begin on the visible picture; a second pinch finger may land outside it.
    if (gestureRef.current.pointers.length === 0) {
      const stage = stageSizeRef.current;
      const picture = pictureSizeRef.current;
      const fit = Math.min(stage.width / picture.width, stage.height / picture.height);
      const view = viewRef.current;
      const right = view.tx + picture.width * fit * view.scale;
      const bottom = view.ty + picture.height * fit * view.scale;
      if (x < view.tx || x > right || y < view.ty || y > bottom) return;
    }
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture may be unavailable after OS cancellation */ }
    dispatch({ type: 'down', id: event.pointerId, x, y, time: event.timeStamp });
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !gestureRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({ type: 'move', id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, time: event.timeStamp });
  };
  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (!gestureRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (cancel) dispatch({ type: 'cancel', id: event.pointerId, time: event.timeStamp }, true);
    else dispatch({ type: 'up', id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, time: event.timeStamp }, true);
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released by the platform */ }
  };
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!enabled || !gestureRef.current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    dispatch({ type: 'wheel', x: event.clientX - rect.left, y: event.clientY - rect.top, deltaY: event.deltaY, ctrlKey: event.ctrlKey, time: event.timeStamp }, true);
  };

  return (
    <div
      ref={stageRef}
      className={`relative w-full h-full min-w-0 min-h-0 overflow-hidden ${className}`}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onLostPointerCapture={(event) => {
        if (gestureRef.current?.pointers.some((p) => p.id === event.pointerId)) dispatch({ type: 'cancel', id: event.pointerId, time: event.timeStamp }, true);
      }}
      onWheel={handleWheel}
    >
      <div ref={pictureRef} style={{ position: 'absolute', left: 0, top: 0, width: pictureWidth, height: pictureHeight, transformOrigin: '0 0', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
};

export default ZoomStage;
