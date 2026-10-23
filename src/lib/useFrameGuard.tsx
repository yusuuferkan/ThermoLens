import { router } from 'expo-router';

import { Button, Empty } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

/** Shared empty state for tabs that need a loaded image. */
export function NoImage() {
  const t = useT();
  return (
    <Screen>
      <Empty
        icon="thermometer-outline"
        title={t('noImageTitle')}
        body={t('noImageBody')}
        action={<Button label={t('goGallery')} icon="images-outline" onPress={() => router.navigate('/')} />}
      />
    </Screen>
  );
}
