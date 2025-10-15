export const STREAM_SOURCES = [
  { id: 'data', label: 'Data feed (default)' },
  { id: 'audio-dispatch', label: 'Dispatch audio stream' },
  { id: 'audio-tactical', label: 'Tactical audio stream' }
] as const;

export type StreamSource = (typeof STREAM_SOURCES)[number]['id'];

export const DEFAULT_STREAM_SOURCE: StreamSource = 'data';

export function isValidStreamSource(value: unknown): value is StreamSource {
  if (typeof value !== 'string') {
    return false;
  }
  return STREAM_SOURCES.some((source) => source.id === value);
}
