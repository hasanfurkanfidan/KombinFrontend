import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';

import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ErrorState } from '@/components/ErrorState';
import { LiveText } from '@/components/LiveText';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { ToastHost } from '@/components/ToastHost';
import { showToast, useToastStore } from '@/components/toastStore';
import { ProductCard } from '@/features/catalog/ProductCard';
import { OutfitMiniFigure } from '@/features/outfits/OutfitMiniFigure';
import { OutfitPieces, spokenPiece } from '@/features/outfits/OutfitPieces';
import { SwipeDeck } from '@/features/onboarding/SwipeDeck';
import { theme } from '@/theme';
import { announce, LARGE_TEXT_SCALE, lines, readingTime, resetAnnouncements } from '@/utils/a11y';

import { gapPiece, listItem, needsOneOutfit, outfit, outfitPiece, styleCard } from '../fixtures';
import { renderWithQuery } from '../testUtils';
import { flat, HIDDEN, withFontScale } from './support';

const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => {
  announceSpy.mockClear();
  resetAnnouncements();
  useToastStore.getState().hide();
  Platform.OS = 'ios';
});

describe('text scaling helpers', () => {
  it('keeps a line cap at the default size and lifts it from 1.3x', async () => {
    await withFontScale(1, async () => expect(lines(2)).toBe(2));
    await withFontScale(LARGE_TEXT_SCALE, async () => expect(lines(2)).toBeUndefined());
    await withFontScale(2, async () => expect(lines(1)).toBeUndefined());
  });

  it('lets a timed message stay longer at large text, much longer with a screen reader', () => {
    expect(readingTime(2500, false, 1)).toBe(2500);
    expect(readingTime(2500, false, 1.5)).toBe(5000);
    expect(readingTime(2500, true, 1)).toBe(10000);
  });
});

describe('announce', () => {
  it('speaks once, even when several skeletons ask together', () => {
    announce('Yükleniyor');
    announce('Yükleniyor');
    announce('Başka');

    expect(announceSpy.mock.calls.map(([message]) => message)).toEqual(['Yükleniyor', 'Başka']);
  });

  it('leaves Android to its live regions when asked to speak on iOS only', () => {
    Platform.OS = 'android';
    announce('Hata', 'ios');
    expect(announceSpy).not.toHaveBeenCalled();
    announce('Hata', 'all');
    expect(announceSpy).toHaveBeenCalledWith('Hata');
  });

  it('is said once by a skeleton and once by an error state', async () => {
    await render(
      <>
        <Skeleton height={10} />
        <Skeleton height={10} />
      </>,
    );
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith('Yükleniyor');

    announceSpy.mockClear();
    await render(<ErrorState />);
    expect(announceSpy).toHaveBeenCalledWith(expect.stringMatching(/^Bir şeyler ters gitti\./));
  });
});

describe('Button', () => {
  it('keeps its name while it shows a spinner', async () => {
    await render(<Button label="Kaydet" onPress={jest.fn()} loading />);

    const button = screen.getByRole('button', { name: 'Kaydet' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('grows with large text instead of cutting its label', async () => {
    await render(
      <Button label="Hesabımı kalıcı olarak sil" onPress={jest.fn()} variant="danger" />,
    );

    const label = screen.getByText('Hesabımı kalıcı olarak sil');
    expect(label.props.numberOfLines).toBeUndefined();
    const style = flat(screen.getByRole('button').props.style);
    expect(style.minHeight).toBe(theme.sizes.buttonHeight);
    expect(style.height).toBeUndefined();
  });

  it('passes a hint and prefers an explicit name over the label', async () => {
    await render(
      <Button
        label="Trendyol'dan al · 2.499 ₺"
        accessibilityLabel="Satın al: Trendyol, 2.499 lira"
        accessibilityHint="Satıcının sitesi açılır"
        onPress={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Satın al: Trendyol, 2.499 lira' });
    expect(button.props.accessibilityHint).toBe('Satıcının sitesi açılır');
  });
});

describe('Chip', () => {
  it('is 44 wide even for one letter, grows with its label and says whether it is selected', async () => {
    await render(<Chip label="S" selected onPress={jest.fn()} />);

    const chip = screen.getByRole('button');
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    const style = flat(chip.props.style);
    expect(style.minWidth).toBe(theme.sizes.touch);
    expect(style.minHeight).toBe(theme.sizes.chipHeight);
    expect(style.height).toBeUndefined();
    expect(screen.getByText('S').props.numberOfLines).toBeUndefined();
  });
});

describe('TextField', () => {
  it('hands the error to the screen reader as the field’s hint and says it', async () => {
    await render(
      <TextField
        label="E-posta"
        value=""
        onChangeText={jest.fn()}
        error="Geçerli bir e-posta adresi gir"
      />,
    );

    const input = screen.getByLabelText('E-posta');
    expect(input.props.accessibilityHint).toBe('Geçerli bir e-posta adresi gir');
    expect(announceSpy).toHaveBeenCalledWith('Geçerli bir e-posta adresi gir');
    // The visible label is read through the input, not as a second stop.
    expect(screen.getByText('E-posta', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });

  it('uses the hint when there is no error', async () => {
    await render(
      <TextField label="Şifre" value="" onChangeText={jest.fn()} hint="En az 8 karakter" />,
    );

    expect(screen.getByLabelText('Şifre').props.accessibilityHint).toBe('En az 8 karakter');
    expect(announceSpy).not.toHaveBeenCalled();
  });
});

describe('LiveText', () => {
  it('is a polite live region and is announced on iOS, once per message', async () => {
    const { rerender } = await render(<LiveText>Bir şey oldu</LiveText>);

    expect(screen.getByText('Bir şey oldu').props.accessibilityLiveRegion).toBe('polite');
    expect(announceSpy).toHaveBeenCalledTimes(1);

    await rerender(<LiveText>Bir şey oldu</LiveText>);
    expect(announceSpy).toHaveBeenCalledTimes(1);
  });

  it('stays silent on Android, where the live region does the speaking', async () => {
    Platform.OS = 'android';
    await render(<LiveText>Bir şey oldu</LiveText>);

    expect(announceSpy).not.toHaveBeenCalled();
  });
});

describe('AppImage', () => {
  it('is decorative unless it is given a description', async () => {
    await render(
      <>
        <AppImage uri="http://img.test/a.jpg" style={{ width: 10, height: 10 }} testID="plain" />
        <AppImage
          uri="http://img.test/b.jpg"
          style={{ width: 10, height: 10 }}
          accessibilityLabel="Mavi blazer, fotoğraf 1 / 3"
          testID="described"
        />
      </>,
    );

    expect(screen.getByTestId('plain', HIDDEN).props.accessible).toBe(false);
    const described = screen.getByTestId('described');
    expect(described.props.accessible).toBe(true);
    expect(described.props.accessibilityRole).toBe('image');
    expect(described.props.accessibilityLabel).toBe('Mavi blazer, fotoğraf 1 / 3');
  });
});

describe('ToastHost', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is announced, and stays 4 s (8 s with a button) at the default text size', async () => {
    await withFontScale(1, async () => {
      await render(<ToastHost />);

      await act(async () => showToast('Kaydedildi'));
      expect(announceSpy).toHaveBeenCalledWith('Kaydedildi');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3900);
      });
      expect(screen.getByText('Kaydedildi')).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByText('Kaydedildi')).toBeNull();

      await act(async () => showToast('Bugün giydin', { label: 'Geri al', onPress: jest.fn() }));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(7900);
      });
      expect(screen.getByText('Bugün giydin')).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByText('Bugün giydin')).toBeNull();
    });
  });

  it('stays twice as long at large text', async () => {
    await withFontScale(1.5, async () => {
      await render(<ToastHost />);
      await act(async () => showToast('Kaydedildi'));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(7900);
      });
      expect(screen.getByText('Kaydedildi')).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByText('Kaydedildi')).toBeNull();
    });
  });

  it('names its button and makes it 44 high with slop', async () => {
    await render(<ToastHost />);
    await act(async () => showToast('Bugün giydin', { label: 'Geri al', onPress: jest.fn() }));

    const action = screen.getByRole('button', { name: 'Geri al' });
    expect(action.props.hitSlop).toBe(theme.spacing.md);
    expect(announceSpy).toHaveBeenCalledWith('Bugün giydin. Geri al');
  });
});

describe('ProductCard', () => {
  const item = listItem({
    id: 'p1',
    name: 'Yün karışımlı blazer',
    discountPercent: 28,
    matchScore: 94,
    offerCount: 3,
  });

  it('says everything the card shows in the button’s name', async () => {
    await renderWithQuery(<ProductCard product={item} width={170} onPress={jest.fn()} />);

    const label = screen.getByTestId('product-card-p1').props.accessibilityLabel as string;
    expect(label).toContain('Yün karışımlı blazer');
    expect(label).toContain('%28 indirim');
    expect(label).toContain('Sana uygun %94');
    expect(label).toMatch(/3 satıcı/);
  });

  it('keeps the bookmark out of the card’s button: an accessible parent hides its children on iOS', async () => {
    await renderWithQuery(<ProductCard product={item} width={170} onPress={jest.fn()} />);

    const card = screen.getByTestId('product-card-p1');
    const bookmark = screen.getByTestId('save-p1-card');
    expect(card.props.accessible).not.toBe(false);
    // The bookmark is not a descendant of the card button.
    expect(() => within(card).getByTestId('save-p1-card')).toThrow();
    expect(bookmark.props.accessibilityRole).toBe('button');
  });

  it('says a product that is off the market', async () => {
    await renderWithQuery(
      <ProductCard product={{ ...item, isActive: false }} width={170} onPress={jest.fn()} />,
    );

    expect(screen.getByTestId('product-card-p1').props.accessibilityLabel).toContain(
      'Artık satışta değil',
    );
  });
});

describe('the outfit figure reads as one picture with its pieces listed', () => {
  it('lists the pieces head to toe, with what is missing and where it is cheapest', async () => {
    await render(<OutfitPieces pieces={needsOneOutfit().pieces} />);

    const figure = screen.getByTestId('outfit-figure');
    expect(figure.props.accessible).toBe(true);
    expect(figure.props.accessibilityRole).toBe('image');
    expect(figure.props.accessibilityLabel).toBe(
      'Kombin: Bej boğazlı triko, Eksik parça, 649 ₺, En ucuzu Koton; Siyah kumaş pantolon; Kahverengi bot',
    );
  });

  it('names the anchor and a store outfit’s prices', () => {
    expect(spokenPiece(outfitPiece({ role: 'Anchor', name: 'Blazer' }), false)).toBe(
      'Blazer, Ana parça',
    );
    expect(spokenPiece({ ...gapPiece, role: 'Catalog' } as never, true)).toBe(
      'Bej boğazlı triko, 649 ₺',
    );
  });

  it('is a group of controls, not one picture, when each piece carries its own buy link', async () => {
    await render(
      <OutfitPieces pieces={outfit().pieces} detail={(piece) => <Text>{piece.name}</Text>} />,
    );

    expect(screen.getByTestId('outfit-figure').props.accessible).toBe(false);
  });

  it('describes the home card’s small figure the same way', async () => {
    await render(<OutfitMiniFigure pieces={outfit().pieces} testID="mini" />);

    const mini = screen.getByTestId('mini');
    expect(mini.props.accessibilityRole).toBe('image');
    expect(mini.props.accessibilityLabel).toBe(
      'Kombin: Koyu yeşil blazer, Siyah kumaş pantolon, Kahverengi bot',
    );
  });
});

describe('SwipeDeck', () => {
  const cards = [styleCard('c1'), styleCard('c2'), styleCard('c3')];

  it('reads one card at a time, as "Kart 1 / 3", and announces the next one', async () => {
    await renderWithQuery(<SwipeDeck cards={cards} onSwipe={jest.fn()} onFinish={jest.fn()} />);

    const top = screen.getByTestId('swipe-card-c1');
    expect(top.props.accessible).toBe(true);
    expect(top.props.accessibilityLabel).toMatch(/^Kart 1 \/ 3: Kart c1, /);
    expect(top.props.accessibilityLiveRegion).toBe('polite');
    expect(announceSpy).toHaveBeenCalledWith(expect.stringMatching(/^Kart 1 \/ 3/));

    announceSpy.mockClear();
    await fireEvent.press(screen.getByTestId('swipe-like'));
    expect(screen.getByTestId('swipe-card-c2').props.accessibilityLabel).toMatch(/^Kart 2 \/ 3/);
    expect(announceSpy).toHaveBeenCalledWith(expect.stringMatching(/^Kart 2 \/ 3/));
  });

  it('hides the stamps and has a button for every decision', async () => {
    await renderWithQuery(<SwipeDeck cards={cards} onSwipe={jest.fn()} onFinish={jest.fn()} />);

    expect(screen.queryByText('Beğendim')).toBeNull();
    expect(screen.getByText('Beğendim', HIDDEN)).toBeTruthy();
    for (const id of ['swipe-dislike', 'swipe-skip', 'swipe-like']) {
      const button = screen.getByTestId(id);
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBeTruthy();
      const style = StyleSheet.flatten(button.props.style) as { width: number; height: number };
      expect(style.width).toBeGreaterThanOrEqual(theme.sizes.touch);
      expect(style.height).toBeGreaterThanOrEqual(theme.sizes.touch);
    }
  });
});
