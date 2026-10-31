import { ErrorState } from '@/ui/error-state';

export default function NotFound() {
  return <ErrorState error={{ code: 'DATASET_NOT_FOUND', message: 'That page does not exist.', retryable: false }} />;
}
