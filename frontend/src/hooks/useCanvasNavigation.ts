import { useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export interface UseCanvasNavigationOptions {
  disabled?: boolean;
  baseSpeed?: number;
  fastSpeed?: number;
  acceleration?: number;
  deceleration?: number;
}

const DEFAULT_BASE_SPEED = 1000;
const DEFAULT_FAST_SPEED = 2200;
const DEFAULT_ACCELERATION = 14;
const DEFAULT_DECELERATION = 7;

export interface Vector2 {
  x: number;
  y: number;
}

export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tagName = el.tagName?.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  const htmlEl = el as HTMLElement;
  if (htmlEl.isContentEditable || htmlEl.contentEditable === 'true' || el.getAttribute?.('contenteditable') === 'true') {
    return true;
  }
  if (el.closest?.('input, textarea, select, [contenteditable="true"], .nokey')) return true;
  return false;
}

export function isDirectionalKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === 'w' ||
    k === 's' ||
    k === 'a' ||
    k === 'd' ||
    k === 'arrowup' ||
    k === 'arrowdown' ||
    k === 'arrowleft' ||
    k === 'arrowright'
  );
}

export function calculateTargetVelocity(activeKeys: Set<string>, speed: number): Vector2 {
  let dirX = 0;
  let dirY = 0;
  if (activeKeys.has('w') || activeKeys.has('arrowup')) dirY += 1;
  if (activeKeys.has('s') || activeKeys.has('arrowdown')) dirY -= 1;
  if (activeKeys.has('a') || activeKeys.has('arrowleft')) dirX += 1;
  if (activeKeys.has('d') || activeKeys.has('arrowright')) dirX -= 1;

  if (dirX === 0 && dirY === 0) {
    return { x: 0, y: 0 };
  }

  const len = Math.hypot(dirX, dirY);
  return {
    x: (dirX / len) * speed,
    y: (dirY / len) * speed,
  };
}

export function updatePhysicsVelocity(
  current: Vector2,
  target: Vector2,
  dt: number,
  accel = DEFAULT_ACCELERATION,
  decel = DEFAULT_DECELERATION
): Vector2 {
  const isMoving = target.x !== 0 || target.y !== 0;
  const rate = isMoving ? accel : decel;
  const factor = 1 - Math.exp(-rate * dt);

  const nextX = current.x + (target.x - current.x) * factor;
  const nextY = current.y + (target.y - current.y) * factor;

  if (!isMoving && Math.abs(nextX) < 0.5 && Math.abs(nextY) < 0.5) {
    return { x: 0, y: 0 };
  }

  return { x: nextX, y: nextY };
}

export function useCanvasNavigation(options: UseCanvasNavigationOptions = {}) {
  const {
    disabled = false,
    baseSpeed = DEFAULT_BASE_SPEED,
    fastSpeed = DEFAULT_FAST_SPEED,
    acceleration = DEFAULT_ACCELERATION,
    deceleration = DEFAULT_DECELERATION,
  } = options;

  const { getViewport, setViewport } = useReactFlow();

  const activeKeysRef = useRef<Set<string>>(new Set());
  const isShiftRef = useRef<boolean>(false);
  const velocityRef = useRef<Vector2>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const getViewportRef = useRef(getViewport);
  getViewportRef.current = getViewport;
  const setViewportRef = useRef(setViewport);
  setViewportRef.current = setViewport;

  const stopLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const tick = useCallback(
    (currentTime: number) => {
      const dt = Math.max(0.001, Math.min((currentTime - lastTimeRef.current) / 1000, 0.05));
      lastTimeRef.current = currentTime;

      const currentSpeed = isShiftRef.current ? fastSpeed : baseSpeed;
      const targetVel = calculateTargetVelocity(activeKeysRef.current, currentSpeed);

      velocityRef.current = updatePhysicsVelocity(
        velocityRef.current,
        targetVel,
        dt,
        acceleration,
        deceleration
      );

      const vx = velocityRef.current.x;
      const vy = velocityRef.current.y;

      if (vx === 0 && vy === 0 && targetVel.x === 0 && targetVel.y === 0) {
        if (rafIdRef.current !== null && typeof globalThis.cancelAnimationFrame === 'function') {
          globalThis.cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = null;
        return;
      }

      const getVp = getViewportRef.current;
      const setVp = setViewportRef.current;

      if (typeof setVp === 'function') {
        const current = typeof getVp === 'function' ? getVp() : { x: 0, y: 0, zoom: 1 };
        const currentX = current?.x ?? 0;
        const currentY = current?.y ?? 0;
        const zoom = current?.zoom ?? 1;

        void setVp({
          x: currentX + vx * dt,
          y: currentY + vy * dt,
          zoom,
        });
      }

      if (typeof globalThis.requestAnimationFrame === 'function') {
        rafIdRef.current = globalThis.requestAnimationFrame(tick);
      }
    },
    [baseSpeed, fastSpeed, acceleration, deceleration]
  );

  const startLoop = useCallback(
    (now = typeof performance !== 'undefined' ? performance.now() : Date.now()) => {
      if (rafIdRef.current !== null && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTimeRef.current = now;
      tick(now + 16);
    },
    [tick]
  );

  const panUp = useCallback(
    (impulse = baseSpeed * 0.4) => {
      velocityRef.current.y += impulse;
      startLoop();
    },
    [baseSpeed, startLoop]
  );

  const panDown = useCallback(
    (impulse = baseSpeed * 0.4) => {
      velocityRef.current.y -= impulse;
      startLoop();
    },
    [baseSpeed, startLoop]
  );

  const panLeft = useCallback(
    (impulse = baseSpeed * 0.4) => {
      velocityRef.current.x += impulse;
      startLoop();
    },
    [baseSpeed, startLoop]
  );

  const panRight = useCallback(
    (impulse = baseSpeed * 0.4) => {
      velocityRef.current.x -= impulse;
      startLoop();
    },
    [baseSpeed, startLoop]
  );

  useEffect(() => {
    if (disabled) {
      activeKeysRef.current.clear();
      isShiftRef.current = false;
      stopLoop();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const active = typeof globalThis !== 'undefined' ? globalThis.document?.activeElement : null;
      if (isEditableElement(active)) return;

      if (!isDirectionalKey(event.key)) return;

      event.preventDefault();
      isShiftRef.current = event.shiftKey;
      activeKeysRef.current.add(event.key.toLowerCase());
      startLoop();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      isShiftRef.current = event.shiftKey;
      activeKeysRef.current.delete(event.key.toLowerCase());
    };

    const handleBlur = () => {
      activeKeysRef.current.clear();
      isShiftRef.current = false;
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);
    globalThis.addEventListener('blur', handleBlur);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
      globalThis.removeEventListener('blur', handleBlur);
      stopLoop();
    };
  }, [disabled, startLoop, stopLoop]);

  return {
    panUp,
    panDown,
    panLeft,
    panRight,
    stop: stopLoop,
  };
}
