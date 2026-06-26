import axios from 'axios';
import Dexie from 'dexie';
import store from '@/store';
// import pkg from "../../package.json";

const db = new Dexie('yesplaymusic');

db.version(4).stores({
  trackDetail: '&id, updateTime',
  lyric: '&id, updateTime',
  album: '&id, updateTime',
});

db.version(5).stores({
  trackSources: '&id, createTime',
  trackDetail: '&id, updateTime',
  lyric: '&id, updateTime',
  album: '&id, updateTime',
  playStats: '&id, lastPlayedAt, updatedAt',
  playEvents: '++id, playedAt, trackId',
});

db.version(3)
  .stores({
    trackSources: '&id, createTime',
  })
  .upgrade(tx =>
    tx
      .table('trackSources')
      .toCollection()
      .modify(
        track => !track.createTime && (track.createTime = new Date().getTime())
      )
  );

db.version(1).stores({
  trackSources: '&id',
});

let tracksCacheBytes = 0;

const cacheTables = [
  {
    key: 'trackSources',
    tableName: 'trackSources',
    getBytes: track => track?.source?.byteLength || 0,
  },
  {
    key: 'trackDetail',
    tableName: 'trackDetail',
    getBytes: track => getApproxBytes(track),
  },
  {
    key: 'lyric',
    tableName: 'lyric',
    getBytes: lyric => getApproxBytes(lyric),
  },
  {
    key: 'album',
    tableName: 'album',
    getBytes: album => getApproxBytes(album),
  },
];

function getApproxBytes(value) {
  if (value === undefined || value === null) return 0;
  if (value.byteLength !== undefined) return value.byteLength;
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch (error) {
    return 0;
  }
}

// 等待 settings 可用
async function waitForSettingsReady(timeoutMs = 5000) {
  const interval = 100;
  const maxTries = Math.ceil(timeoutMs / interval);
  let tries = 0;
  while (
    (store.state == null ||
      store.state.settings == null ||
      store.state.settings.cacheLimit === undefined) &&
    tries < maxTries
  ) {
    await new Promise(resolve => setTimeout(resolve, interval));
    tries++;
  }
  return store.state && store.state.settings;
}

// 初始化现有缓存总大小，确保应用启动时能正确判断并清理超限缓存
async function initTracksCacheBytes() {
  if (!process.env.IS_ELECTRON) return;
  try {
    await waitForSettingsReady();
    const all = await db.trackSources.toArray();
    tracksCacheBytes = all.reduce(
      (sum, t) => sum + (t?.source?.byteLength || 0),
      0
    );
    console.debug(
      '[debug][db.js] initTracksCacheBytes, total bytes:',
      tracksCacheBytes
    );
    deleteExcessCache();
  } catch (err) {
    console.debug('[debug][db.js] initTracksCacheBytes failed', err);
  }
}

// 模块加载时触发初始化
initTracksCacheBytes();

async function deleteExcessCache() {
  if (
    store.state.settings.cacheLimit === false ||
    tracksCacheBytes < store.state.settings.cacheLimit * Math.pow(1024, 2)
  ) {
    return;
  }
  try {
    const delCache = await db.trackSources.orderBy('createTime').first();
    await db.trackSources.delete(delCache.id);
    tracksCacheBytes -= delCache.source.byteLength;
    console.debug(
      `[debug][db.js] deleteExcessCacheSucces, track: ${delCache.name}, size: ${delCache.source.byteLength}, cacheSize:${tracksCacheBytes}`
    );
    deleteExcessCache();
  } catch (error) {
    console.debug('[debug][db.js] deleteExcessCacheFailed', error);
  }
}

export function cacheTrackSource(trackInfo, url, bitRate, from = 'netease') {
  if (!process.env.IS_ELECTRON) return;
  const name = trackInfo.name;
  const artist =
    (trackInfo.ar && trackInfo.ar[0]?.name) ||
    (trackInfo.artists && trackInfo.artists[0]?.name) ||
    'Unknown';
  let cover = trackInfo.al.picUrl;
  if (cover.slice(0, 5) !== 'https') {
    cover = 'https' + cover.slice(4);
  }
  axios.get(`${cover}?param=512y512`);
  axios.get(`${cover}?param=224y224`);
  axios.get(`${cover}?param=1024y1024`);
  return axios
    .get(url, {
      responseType: 'arraybuffer',
    })
    .then(response => {
      db.trackSources.put({
        id: trackInfo.id,
        source: response.data,
        bitRate,
        from,
        name,
        artist,
        createTime: new Date().getTime(),
      });
      console.debug(`[debug][db.js] cached track 👉 ${name} by ${artist}`);
      tracksCacheBytes += response.data.byteLength;
      deleteExcessCache();
      return { trackID: trackInfo.id, source: response.data, bitRate };
    });
}

export function getTrackSource(id) {
  return db.trackSources.get(Number(id)).then(track => {
    if (!track) return null;
    console.debug(
      `[debug][db.js] get track from cache 👉 ${track.name} by ${track.artist}`
    );
    return track;
  });
}

export function cacheTrackDetail(track, privileges) {
  db.trackDetail.put({
    id: track.id,
    detail: track,
    privileges: privileges,
    updateTime: new Date().getTime(),
  });
}

export function getTrackDetailFromCache(ids) {
  return db.trackDetail
    .filter(track => {
      return ids.includes(String(track.id));
    })
    .toArray()
    .then(tracks => {
      const result = { songs: [], privileges: [] };
      ids.map(id => {
        const one = tracks.find(t => String(t.id) === id);
        result.songs.push(one?.detail);
        result.privileges.push(one?.privileges);
      });
      if (result.songs.includes(undefined)) {
        return undefined;
      }
      return result;
    });
}

export function cacheLyric(id, lyrics) {
  db.lyric.put({
    id,
    lyrics,
    updateTime: new Date().getTime(),
  });
}

export function getLyricFromCache(id) {
  return db.lyric.get(Number(id)).then(result => {
    if (!result) return undefined;
    return result.lyrics;
  });
}

export function cacheAlbum(id, album) {
  db.album.put({
    id: Number(id),
    album,
    updateTime: new Date().getTime(),
  });
}

export function getAlbumFromCache(id) {
  return db.album.get(Number(id)).then(result => {
    if (!result) return undefined;
    return result.album;
  });
}

export function countDBSize() {
  const trackSizes = [];
  return db.trackSources
    .each(track => {
      trackSizes.push(track.source.byteLength);
    })
    .then(() => {
      const res = {
        bytes: trackSizes.reduce((s1, s2) => s1 + s2, 0),
        length: trackSizes.length,
      };
      tracksCacheBytes = res.bytes;
      console.debug(
        `[debug][db.js] load tracksCacheBytes: ${tracksCacheBytes}`
      );
      return res;
    });
}

export function getCacheSummary() {
  return Promise.all(
    cacheTables.map(cacheTable => {
      const table = db.table(cacheTable.tableName);
      return table.toArray().then(records => {
        const bytes = records.reduce(
          (total, record) => total + cacheTable.getBytes(record),
          0
        );
        if (cacheTable.tableName === 'trackSources') {
          tracksCacheBytes = bytes;
        }
        return {
          key: cacheTable.key,
          tableName: cacheTable.tableName,
          length: records.length,
          bytes,
        };
      });
    })
  );
}

export function clearCacheTable(tableName) {
  const cacheTable = cacheTables.find(cache => cache.tableName === tableName);
  if (cacheTable === undefined) return Promise.resolve();

  return db
    .table(cacheTable.tableName)
    .clear()
    .then(() => {
      if (cacheTable.tableName === 'trackSources') {
        tracksCacheBytes = 0;
      }
    });
}

export function clearDB() {
  return Promise.all(
    cacheTables.map(function (cacheTable) {
      return db.table(cacheTable.tableName).clear();
    })
  ).then(() => {
    tracksCacheBytes = 0;
  });
}

function buildPlayStatRecord(track, playedSeconds, playedAt) {
  const artistNames = (track?.ar || track?.artists || []).map(artist => {
    return artist.name;
  });
  const album = track?.al || track?.album || {};
  const duration = ~~((track?.dt || track?.duration || 0) / 1000);
  const countedAsPlay =
    playedSeconds >= Math.max(15, Math.min(30, Math.floor(duration * 0.25))) ||
    (duration > 0 && playedSeconds >= duration);

  return {
    id: Number(track.id),
    trackId: Number(track.id),
    name: track.name || 'Unknown Track',
    artists: artistNames,
    artistText: artistNames.join(', '),
    album: {
      id: album.id || 0,
      name: album.name || '',
      picUrl: album.picUrl || '',
    },
    dt: track?.dt || duration * 1000,
    duration,
    playCount: countedAsPlay ? 1 : 0,
    totalPlayedSeconds: playedSeconds,
    lastPlayedAt: playedAt,
    updatedAt: playedAt,
    countedAsPlay,
  };
}

export function recordTrackPlay(track, time, completed = false) {
  if (!track?.id) return Promise.resolve();

  const duration = ~~((track?.dt || 0) / 1000);
  const playedSeconds = Math.max(
    1,
    completed ? duration : Math.min(duration || ~~time, ~~time || 0)
  );
  const playedAt = Date.now();
  const record = buildPlayStatRecord(track, playedSeconds, playedAt);

  return db.transaction('rw', db.playStats, db.playEvents, async () => {
    const existing = await db.playStats.get(record.id);
    if (existing) {
      await db.playStats.put({
        ...existing,
        ...record,
        playCount: (existing.playCount || 0) + (record.playCount || 0),
        totalPlayedSeconds: (existing.totalPlayedSeconds || 0) + playedSeconds,
      });
    } else {
      await db.playStats.put(record);
    }

    await db.playEvents.add({
      trackId: record.trackId,
      playedAt,
      playedSeconds,
      completed,
      countedAsPlay: record.countedAsPlay,
      name: record.name,
      artists: record.artists,
      artistText: record.artistText,
      album: record.album,
      dt: record.dt,
    });
  });
}

function mapStatsToTracks(stats) {
  return stats.map(stat => {
    return {
      id: stat.trackId,
      name: stat.name,
      ar: (stat.artists || []).map((name, index) => ({
        id: `${stat.trackId}-${index}`,
        name,
      })),
      al: stat.album || {
        id: 0,
        name: '',
        picUrl: '',
      },
      dt: stat.dt || (stat.duration || 0) * 1000,
      playable: true,
      playCount: stat.playCount || 0,
      localTotalPlayedSeconds: stat.totalPlayedSeconds || 0,
      lastPlayedAt: stat.lastPlayedAt || 0,
    };
  });
}

function getWeekStartTimestamp() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - diff);
  return now.getTime();
}

export function getLocalPlayHistorySummary() {
  return Promise.all([db.playStats.toArray(), db.playEvents.toArray()]).then(
    ([stats, events]) => {
      const sortedStats = stats.sort((a, b) => {
        return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      });
      const weekStart = getWeekStartTimestamp();
      const weekMap = new Map();

      events.forEach(event => {
        if ((event.playedAt || 0) < weekStart) return;
        const current = weekMap.get(event.trackId);
        if (current) {
          current.playCount += event.countedAsPlay ? 1 : 0;
          current.totalPlayedSeconds += event.playedSeconds || 0;
          current.lastPlayedAt = Math.max(
            current.lastPlayedAt || 0,
            event.playedAt || 0
          );
        } else {
          weekMap.set(event.trackId, {
            id: event.trackId,
            trackId: event.trackId,
            name: event.name,
            artists: event.artists || [],
            album: event.album || { id: 0, name: '', picUrl: '' },
            dt: event.dt || 0,
            playCount: event.countedAsPlay ? 1 : 0,
            totalPlayedSeconds: event.playedSeconds || 0,
            lastPlayedAt: event.playedAt || 0,
          });
        }
      });

      const weekStats = Array.from(weekMap.values()).sort((a, b) => {
        if ((b.playCount || 0) !== (a.playCount || 0)) {
          return (b.playCount || 0) - (a.playCount || 0);
        }
        return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      });

      const totalPlayedSeconds = stats.reduce((sum, stat) => {
        return sum + (stat.totalPlayedSeconds || 0);
      }, 0);
      const totalPlayCount = stats.reduce((sum, stat) => {
        return sum + (stat.playCount || 0);
      }, 0);

      return {
        stats: {
          totalPlayedSeconds,
          totalPlayCount,
          totalTracks: stats.length,
          recentTracks: mapStatsToTracks(sortedStats.slice(0, 12)),
        },
        allData: mapStatsToTracks(
          [...stats].sort((a, b) => {
            if ((b.playCount || 0) !== (a.playCount || 0)) {
              return (b.playCount || 0) - (a.playCount || 0);
            }
            return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
          })
        ),
        weekData: mapStatsToTracks(weekStats),
      };
    }
  );
}

export function clearLocalPlayHistory() {
  return Promise.all([db.playStats.clear(), db.playEvents.clear()]);
}
