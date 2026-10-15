import { UNDO_PAUSE_MS, UndoHistory } from './undo-history';

describe('UndoHistory', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const settle = () => jest.advanceTimersByTime(UNDO_PAUSE_MS);

  it('has nothing to undo until a change has been settled on', () => {
    const history = new UndoHistory<string>('a');

    expect(history.canUndo()).toBe(false);
    expect(history.undo()).toBeNull();
  });

  it('goes back to where the last settled change started', () => {
    const history = new UndoHistory<string>('a');
    history.note('b');
    settle();
    history.note('c');
    settle();

    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeNull();
    expect(history.canUndo()).toBe(false);
  });

  it('counts a run of quick changes, such as typing, as one', () => {
    const history = new UndoHistory<string>('4');
    history.note('41');
    history.note('415');
    history.note('4150');
    settle();

    expect(history.undo()).toBe('4');
    expect(history.undo()).toBeNull();
  });

  it('does not count a change that ends where it began', () => {
    const history = new UndoHistory<string>('a');
    history.note('b');
    history.note('a');
    settle();

    expect(history.canUndo()).toBe(false);
  });

  it('forgets the oldest changes past its limit', () => {
    const history = new UndoHistory<number>(0, 3);
    for (let i = 1; i <= 5; i++) {
      history.note(i);
      settle();
    }

    expect([history.undo(), history.undo(), history.undo(), history.undo()]).toEqual([4, 3, 2, null]);
  });

  it('settles what is waiting before going back, so a change just made is undone, not lost', () => {
    const history = new UndoHistory<string>('a');
    history.note('b'); // not settled yet

    expect(history.undo()).toBe('a');
  });

  it('compares by value, so an equal request is not a change', () => {
    const history = new UndoHistory<{ price: number }>({ price: 1 });
    history.note({ price: 1 });
    settle();

    expect(history.canUndo()).toBe(false);
  });
});
