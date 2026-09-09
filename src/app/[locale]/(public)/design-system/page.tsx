import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Alert,
  EmptyState,
  LoadingState,
  Table,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
export const metadata = { robots: { index: false, follow: false } };
export default async function DesignSystem({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dictionary(locale);
  return (
    <div className="container page">
      <p className="eyebrow">{t.showcase}</p>
      <h1>{t.components}</h1>
      <Alert>{t.notice}</Alert>
      <div className="swatches">
        {['#0B1F33', '#1677FF', '#22C7E8', '#F5F7FA', '#FFFFFF'].map((color) => (
          <div key={color}>
            <div className="swatch" style={{ background: color }} />
            <small dir="ltr">{color}</small>
          </div>
        ))}
      </div>
      <div className="showcase-grid">
        <Card>
          <div className="stack">
            <h2>{t.primary}</h2>
            <div className="actions">
              <Button>{t.primary}</Button>
              <Button variant="secondary">{t.secondary}</Button>
              <Button disabled>{t.primary}</Button>
            </div>
            <Input id="demo-name" label={t.name} />
            <Select id="demo-region" label={t.region}>
              <option>{t.choose}</option>
              <option>{t.sample}</option>
            </Select>
            <Modal trigger={t.modal} title={t.modalTitle} body={t.modalBody} close={t.close} />
          </div>
        </Card>
        <Card>
          <div className="stack">
            <h2>{t.status}</h2>
            <div>
              <Badge>{t.active}</Badge>
            </div>
            <Alert tone="success">{t.success}</Alert>
            <Alert tone="error">{t.errorBody}</Alert>
            <LoadingState label={t.loading} />
          </div>
        </Card>
        <Card>
          <EmptyState title={t.empty}>{t.emptyBody}</EmptyState>
        </Card>
        <Card>
          <Table
            caption={t.sample}
            columns={[t.name, t.status]}
            rows={[[t.sample, <Badge key="status">{t.active}</Badge>]]}
          />
        </Card>
      </div>
    </div>
  );
}
