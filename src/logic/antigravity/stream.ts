import { useCallback, useSyncExternalStore } from 'react';

export type Listener<T> = (value: T) => void;
export interface ReadonlyStream<T> { readonly value: T; subscribe(listener: Listener<T>): () => void; }

export class Stream<T> {
  private listeners: Set<Listener<T>> = new Set();
  private currentValue: T;

  constructor(initialValue: T) {
    this.currentValue = initialValue;
  }

  get value(): T {
    return this.currentValue;
  }

  set(newValue: T) {
    this.currentValue = newValue;
    this.notify();
  }

  update(updater: (val: T) => T) {
    this.currentValue = updater(this.currentValue);
    this.notify();
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentValue));
  }
}

export function createStream<T>(initialValue: T): Stream<T> {
  return new Stream<T>(initialValue);
}

export function useStream<T>(stream: ReadonlyStream<T>): T {
  const subscribe = useCallback((listener: Listener<T>) => stream.subscribe(listener), [stream]);
  const getSnapshot = useCallback(() => stream.value, [stream]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
