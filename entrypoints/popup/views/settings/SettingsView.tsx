import { ViewLayout } from '../../components/ViewLayout';
import { i18n } from '@/shared/i18n';
import { UserIdentitySection } from './UserIdentitySection';
import { AppearanceSection } from './AppearanceSection';
import { ProblemAutoClearSection } from './ProblemAutoClearSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';
import { NotionSyncSection } from './NotionSyncSection';
import { DataSection } from './DataSection';
import { AboutSection } from './AboutSection';

export function SettingsView() {
  return (
    <ViewLayout title={i18n.settings.title}>
      <UserIdentitySection />
      <NotionSyncSection />
      <AppearanceSection />
      {/* <ProblemAutoClearSection />
      <ReviewSettingsSection /> */}
      <DataSection />
      {/* <AboutSection /> */}
    </ViewLayout>
  );
}
