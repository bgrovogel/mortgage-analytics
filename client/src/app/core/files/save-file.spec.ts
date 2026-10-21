import { saveFile } from './save-file';

describe('saveFile', () => {
  afterEach(() => jest.restoreAllMocks());

  it('hands the browser the content as a file of the given name and type, then lets go of it', () => {
    const create = jest.fn().mockReturnValue('blob:file-1');
    const revoke = jest.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string }[] = [];
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });

    saveFile('data.json', '{"a":1}', 'application/json');

    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBe(7);
    expect(clicked).toEqual([{ href: 'blob:file-1', download: 'data.json' }]);
    expect(revoke).toHaveBeenCalledWith('blob:file-1');
  });
});
