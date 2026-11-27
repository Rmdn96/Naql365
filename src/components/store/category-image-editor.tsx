'use client';

import { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui/primitives';
import { SourceImage } from '@/components/lovable/source-image';

export function CategoryImageEditor({
  locale,
  categoryId,
  revision,
  image,
  canApprove,
}: {
  locale: 'ar' | 'en';
  categoryId: string;
  revision: number;
  image?: { id: string; approved: boolean } | undefined;
  canApprove: boolean;
}) {
  const ar = locale === 'ar';
  const router = useRouter();
  const asset = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const prefix = 'category-image-' + categoryId;

  async function submit(init: RequestInit) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/store/category-media', init);
      if (!response.ok) throw new Error('Category image update failed');
      setNotice(ar ? 'تم حفظ صورة التصنيف.' : 'Category image saved.');
      router.refresh();
    } catch {
      setNotice(
        ar
          ? 'تعذر حفظ الصورة. راجع الملف أو حدّث الصفحة.'
          : 'Image not saved. Check the file or refresh.',
      );
    } finally {
      setBusy(false);
    }
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    asset.current ??= crypto.randomUUID();
    body.set('categoryId', categoryId);
    body.set('revision', String(revision));
    body.set('assetId', asset.current);
    void submit({ method: 'POST', body });
  }

  function change(action: 'remove' | 'approve') {
    if (!image) return;
    void submit({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, assetId: image.id, revision, categoryId }),
    });
  }

  return (
    <details open={!!image}>
      <summary>{ar ? 'صورة التصنيف' : 'Category image'}</summary>
      {image && (
        <div className="store-form">
          <SourceImage
            src={'/api/store/media/' + image.id + '?kind=category'}
            alt={ar ? 'معاينة صورة التصنيف' : 'Category image preview'}
            width={140}
            height={105}
            sizes="140px"
          />
          <p>
            {image.approved
              ? ar
                ? 'صورة معتمدة'
                : 'Approved image'
              : ar
                ? 'صورة مسودة'
                : 'Draft image'}
          </p>
          {canApprove && !image.approved && (
            <Button type="button" disabled={busy} onClick={() => change('approve')}>
              {ar ? 'اعتماد الصورة' : 'Approve image'}
            </Button>
          )}
          <Button type="button" disabled={busy} onClick={() => change('remove')}>
            {ar ? 'إزالة الصورة' : 'Remove image'}
          </Button>
        </div>
      )}
      <form
        className="store-form"
        onSubmit={upload}
        onChange={() => {
          asset.current = null;
        }}
      >
        <label htmlFor={prefix}>{ar ? 'ملف الصورة' : 'Image file'}</label>
        <input
          id={prefix}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <Input
          id={prefix + '-rights'}
          name="rightsReference"
          label={ar ? 'مرجع موافقة حقوق الصورة' : 'Image rights approval reference'}
          maxLength={200}
          required
        />
        <Button disabled={busy}>
          {image ? (ar ? 'تغيير الصورة' : 'Replace image') : ar ? 'رفع الصورة' : 'Upload image'}
        </Button>
      </form>
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
