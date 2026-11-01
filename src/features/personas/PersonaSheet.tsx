import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import type { Persona } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useActivatePersona, useArchivePersona, useRenamePersona } from './hooks';

interface PersonaSheetProps {
  persona: Persona | null;
  onClose: () => void;
}

type Mode = 'menu' | 'rename' | 'archive';

/** Actions for one persona: activate, rename, re-teach (the swipe step again) and archive (with a confirmation). */
export function PersonaSheet({ persona, onClose }: PersonaSheetProps) {
  return (
    <BottomSheet visible={persona !== null} onClose={onClose} title={persona?.name}>
      {/* Mounted only while a persona is open, so each opening starts on the menu. */}
      {persona ? <PersonaActions persona={persona} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function PersonaActions({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const router = useRouter();
  const activate = useActivatePersona();
  const rename = useRenamePersona();
  const archive = useArchivePersona();
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState(persona.name);
  const [nameError, setNameError] = useState<string | undefined>();

  const submitRename = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setNameError(tr.personaNameLength);
      return;
    }
    rename.mutate(
      { id: persona.id, name: trimmed },
      {
        onSuccess: onClose,
        onError: (error) =>
          error instanceof ApiError && error.errorCode === 'Profile.PersonaNameTaken'
            ? setNameError(tr.personaNameTaken)
            : showToast(tr.errorBody),
      },
    );
  };

  return (
    <>
      {mode === 'menu' ? (
        <>
          {persona.isActive ? null : (
            <Button
              label={tr.personaSheetActivate}
              onPress={() => {
                activate.mutate(persona.id);
                onClose();
              }}
              testID="persona-sheet-activate"
            />
          )}
          <Button
            label={tr.personaSheetRename}
            variant="secondary"
            onPress={() => setMode('rename')}
            testID="persona-sheet-rename"
          />
          <Button
            label={tr.personaSheetRetrain}
            variant="secondary"
            onPress={() => {
              onClose();
              router.push({
                pathname: '/swipe',
                params: { personaId: persona.id, flow: 'retrain', returnTo: '/profile' },
              });
            }}
            testID="persona-sheet-retrain"
          />
          <Button
            label={tr.personaSheetArchive}
            variant="secondary"
            onPress={() => setMode('archive')}
            testID="persona-sheet-archive"
          />
        </>
      ) : null}

      {mode === 'rename' ? (
        <>
          <TextField
            label={tr.personaNameLabel}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError(undefined);
            }}
            error={nameError}
            maxLength={40}
            testID="persona-rename-input"
          />
          <Button
            label={tr.save}
            onPress={submitRename}
            loading={rename.isPending}
            testID="persona-rename-save"
          />
        </>
      ) : null}

      {mode === 'archive' ? (
        <>
          <Text style={styles.heading}>{tr.personaArchiveTitle(persona.name)}</Text>
          <Text style={styles.body}>{tr.personaArchiveBody}</Text>
          <Button
            label={tr.personaSheetArchive}
            onPress={() =>
              archive.mutate(persona.id, {
                onSuccess: onClose,
                onError: () => showToast(tr.errorBody),
              })
            }
            loading={archive.isPending}
            testID="persona-archive-confirm"
          />
          <Button label={tr.cancel} variant="secondary" onPress={() => setMode('menu')} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});
