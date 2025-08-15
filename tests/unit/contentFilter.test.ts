import { ContentFilter } from '../../src/utils/contentFilter';
import { TorrentItem } from '../../src/types';

describe('ContentFilter', () => {
  describe('isAllowed', () => {
    test('should allow normal content', () => {
      const torrent: TorrentItem = {
        id: 'test1',
        title: 'One Piece Episode 1000',
        magnet: 'magnet:?xt=urn:btih:test',
        size: '1.5 GB',
        sizeBytes: 1610612736,
        seeders: 100,
        leechers: 10,
        downloads: 1000,
        date: '2024-01-01',
        category: '1_0',
        subcategory: 'Anime',
        uploader: 'trusted_user',
        trusted: true,
        remake: false,
      };

      expect(ContentFilter.isAllowed(torrent)).toBe(true);
    });

    test('should block content with prohibited keywords', () => {
      const torrent: TorrentItem = {
        id: 'test2',
        title: 'Some loli content',
        magnet: 'magnet:?xt=urn:btih:test',
        size: '1.5 GB',
        sizeBytes: 1610612736,
        seeders: 100,
        leechers: 10,
        downloads: 1000,
        date: '2024-01-01',
        category: '1_0',
        subcategory: 'Anime',
        uploader: 'user',
        trusted: false,
        remake: false,
      };

      expect(ContentFilter.isAllowed(torrent)).toBe(false);
    });

    test('should block prohibited categories', () => {
      const torrent: TorrentItem = {
        id: 'test3',
        title: 'Normal title',
        magnet: 'magnet:?xt=urn:btih:test',
        size: '1.5 GB',
        sizeBytes: 1610612736,
        seeders: 100,
        leechers: 10,
        downloads: 1000,
        date: '2024-01-01',
        category: '1_3', // Blocked category
        subcategory: 'Junior Idol',
        uploader: 'user',
        trusted: false,
        remake: false,
      };

      expect(ContentFilter.isAllowed(torrent)).toBe(false);
    });

    test('should filter multiple torrents correctly', () => {
      const torrents: TorrentItem[] = [
        {
          id: 'test4',
          title: 'Good anime content',
          magnet: 'magnet:?xt=urn:btih:test1',
          size: '1.5 GB',
          sizeBytes: 1610612736,
          seeders: 100,
          leechers: 10,
          downloads: 1000,
          date: '2024-01-01',
          category: '1_0',
          subcategory: 'Anime',
          uploader: 'user',
          trusted: false,
          remake: false,
        },
        {
          id: 'test5',
          title: 'Bad loli content',
          magnet: 'magnet:?xt=urn:btih:test2',
          size: '1.5 GB',
          sizeBytes: 1610612736,
          seeders: 100,
          leechers: 10,
          downloads: 1000,
          date: '2024-01-01',
          category: '1_0',
          subcategory: 'Anime',
          uploader: 'user',
          trusted: false,
          remake: false,
        },
      ];

      const filtered = ContentFilter.filterTorrents(torrents);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.title).toBe('Good anime content');
    });
  });
});