import { LoadingState } from '@/components/ui/primitives';
export default function Loading() {
  return (
    <div className="container page">
      <LoadingState label="جارٍ التحميل / Loading" />
    </div>
  );
}
