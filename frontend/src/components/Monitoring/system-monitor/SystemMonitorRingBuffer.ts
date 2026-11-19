/**
 * Fixed-capacity circular ring buffer backed by Float32Array.
 * Emulates Microsoft Windows Task Manager's zero-allocation performance architecture.
 */
export class CircularRingBuffer {
  private readonly buffer: Float32Array;
  private readonly capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 1440) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  /**
   * Pushes a new numeric sample into the ring buffer in O(1) time.
   * Overwrites the oldest sample once capacity is reached.
   */
  public push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Current number of stored samples.
   */
  public get length(): number {
    return this.count;
  }

  /**
   * Maximum buffer capacity.
   */
  public get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * Retrieves the most recently added sample in O(1) time.
   */
  public get latest(): number {
    if (this.count === 0) return 0;
    const lastIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIdx];
  }

  /**
   * Exports the ring buffer to a typed Float32Array in chronological order (oldest to newest).
   */
  public toArray(): Float32Array {
    const out = new Float32Array(this.count);
    const startIdx = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      out[i] = this.buffer[(startIdx + i) % this.capacity];
    }
    return out;
  }

  /**
   * Resets the ring buffer.
   */
  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer.fill(0);
  }
}
