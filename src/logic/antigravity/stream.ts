import { useEffect, useState } from 'react';

export type Listener<T> = (value: T) => void;

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
    // Notify immediate value to new subscriber
    listener(this.currentValue);
    
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

export function useStream<T>(stream: Stream<T>): T {
  const [value, setValue] = useState<T>(stream.value);

  useEffect(() => {
    return stream.subscribe((val) => {
      setValue(val);
    });
  }, [stream]);

  return value;
}
