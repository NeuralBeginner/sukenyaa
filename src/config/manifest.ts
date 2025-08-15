import { config } from '../config';

export const manifest: any = {
  id: 'dev.mehdi.sukenyaa',
  version: config.addon.version,
  name: config.addon.name,
  description: config.addon.description,
  logo: config.addon.logo,
  background: config.addon.background,
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series', 'anime', 'other'],
  catalogs: [
    {
      type: 'anime',
      id: 'nyaa-anime-all',
      name: 'Nyaa Anime - All',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'genre',
          isRequired: false,
          options: [
            'Action',
            'Adventure',
            'Comedy',
            'Drama',
            'Fantasy',
            'Horror',
            'Mecha',
            'Music',
            'Mystery',
            'Romance',
            'Sci-Fi',
            'Slice of Life',
            'Sports',
            'Supernatural',
            'Thriller',
          ],
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'anime',
      id: 'nyaa-anime-trusted',
      name: 'Nyaa Anime - Trusted',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'genre',
          isRequired: false,
          options: [
            'Action',
            'Adventure',
            'Comedy',
            'Drama',
            'Fantasy',
            'Horror',
            'Mecha',
            'Music',
            'Mystery',
            'Romance',
            'Sci-Fi',
            'Slice of Life',
            'Sports',
            'Supernatural',
            'Thriller',
          ],
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'movie',
      id: 'nyaa-live-action',
      name: 'Nyaa Live Action',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'other',
      id: 'nyaa-other',
      name: 'Nyaa Other',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
  ],
  idPrefixes: ['nyaa:'],
  behaviorHints: {
    adult: false,
    p2p: true,
    configurable: true,
    configurationRequired: false,
  },
};

export default manifest;
