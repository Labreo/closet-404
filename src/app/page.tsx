import { ClosetApp } from '@/components/ClosetApp';
import { getCoronerReports, getSites } from '@/lib/data';

export default function Home() {
  return <ClosetApp sites={getSites()} coroner={getCoronerReports()} />;
}
