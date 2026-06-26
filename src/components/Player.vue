<template>
  <div class="player" @click="handleClick" @mousedown="handleMouseDown">
    <div
      class="progress-bar"
      :class="{
        nyancat: settings.nyancatStyle,
        'nyancat-stop': settings.nyancatStyle && !player.playing,
      }"
      @click.stop
    >
      <vue-slider
        v-model="player.progress"
        :min="0"
        :max="player.currentTrackDuration"
        :interval="1"
        :drag-on-click="true"
        :duration="0"
        :dot-size="12"
        :height="2"
        :tooltip-formatter="formatTrackTime"
        :lazy="true"
        :silent="true"
      ></vue-slider>
    </div>
    <div class="controls">
      <div class="playing">
        <div class="container" @click.stop>
          <img
            :src="currentTrack.al && currentTrack.al.picUrl | resizeImage(224)"
            loading="lazy"
            @click="goToAlbum"
          />
          <div class="track-info" :title="audioSource">
            <div
              :class="['name', { 'has-list': hasList() }]"
              @click="hasList() && goToList()"
            >
              {{ currentTrack.name }}
            </div>
            <div class="artist">
              <span
                v-for="(ar, index) in currentTrack.ar"
                :key="ar.id"
                @click="ar.id && goToArtist(ar.id)"
              >
                <span :class="{ ar: ar.id }"> {{ ar.name }} </span
                ><span v-if="index !== currentTrack.ar.length - 1">, </span>
              </span>
            </div>
          </div>
          <div class="like-button">
            <button-icon
              :title="
                player.isCurrentTrackLiked
                  ? $t('player.unlike')
                  : $t('player.like')
              "
              @click.native="likeATrack(player.currentTrack.id)"
            >
              <svg-icon
                v-show="!player.isCurrentTrackLiked"
                icon-class="heart"
              ></svg-icon>
              <svg-icon
                v-show="player.isCurrentTrackLiked"
                icon-class="heart-solid"
              ></svg-icon>
            </button-icon>
          </div>
        </div>
        <div class="blank"></div>
      </div>
      <div class="middle-control-buttons">
        <div class="blank"></div>
        <div class="container" @click.stop>
          <button-icon
            v-show="!player.isPersonalFM"
            :title="$t('player.previous')"
            @click.native="playPrevTrack"
            ><svg-icon icon-class="previous"
          /></button-icon>
          <button-icon
            v-show="player.isPersonalFM"
            title="不喜欢"
            @click.native="moveToFMTrash"
            ><svg-icon icon-class="thumbs-down"
          /></button-icon>
          <button-icon
            class="play"
            :title="$t(player.playing ? 'player.pause' : 'player.play')"
            @click.native="playOrPause"
          >
            <svg-icon :icon-class="player.playing ? 'pause' : 'play'"
          /></button-icon>
          <button-icon :title="$t('player.next')" @click.native="playNextTrack"
            ><svg-icon icon-class="next"
          /></button-icon>
        </div>
        <div class="blank"></div>
      </div>
      <div class="right-control-buttons">
        <div class="blank"></div>
        <div class="container" @click.stop>
          <button-icon
            class="queue-button"
            :title="$t('player.nextUp')"
            :class="{
              active: $route.name === 'next',
              disabled: player.isPersonalFM,
            }"
            @click.native="goToNextTracksPage"
            ><svg-icon icon-class="list"
          /></button-icon>
          <button-icon
            class="repeat-button"
            :class="{
              active: player.repeatMode !== 'off',
              disabled: player.isPersonalFM,
            }"
            :title="
              player.repeatMode === 'one'
                ? $t('player.repeatTrack')
                : $t('player.repeat')
            "
            @click.native="switchRepeatMode"
          >
            <svg-icon
              v-show="player.repeatMode !== 'one'"
              icon-class="repeat"
            />
            <svg-icon
              v-show="player.repeatMode === 'one'"
              icon-class="repeat-1"
            />
          </button-icon>
          <button-icon
            class="shuffle-button"
            :class="{ active: player.shuffle, disabled: player.isPersonalFM }"
            :title="$t('player.shuffle')"
            @click.native="switchShuffle"
            ><svg-icon icon-class="shuffle"
          /></button-icon>
          <button-icon
            class="reversed-button"
            v-if="settings.enableReversedMode"
            :class="{ active: player.reversed, disabled: player.isPersonalFM }"
            :title="$t('player.reversed')"
            @click.native="switchReversed"
            ><svg-icon icon-class="sort-up"
          /></button-icon>
          <div class="volume-control">
            <button-icon :title="$t('player.mute')" @click.native="mute">
              <svg-icon v-show="volume > 0.5" icon-class="volume" />
              <svg-icon v-show="volume === 0" icon-class="volume-mute" />
              <svg-icon
                v-show="volume <= 0.5 && volume !== 0"
                icon-class="volume-half"
              />
            </button-icon>
            <div class="volume-bar">
              <vue-slider
                v-model="volume"
                :min="0"
                :max="1"
                :interval="0.01"
                :drag-on-click="true"
                :duration="0"
                tooltip="none"
                :dot-size="12"
              ></vue-slider>
            </div>
          </div>
          <div ref="audioTools" class="audio-tools">
            <button
              class="audio-chip quality-chip"
              :class="{ active: showAudioPanel }"
              @click.stop="toggleAudioPanel"
            >
              {{ qualityChipLabel }}
            </button>
            <button
              class="audio-chip eq-chip"
              :class="{ active: settings.enableEqualizer }"
              @click.stop="toggleAudioPanel"
            >
              <span class="eq-bars">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <div v-if="showAudioPanel" class="audio-panel" @click.stop>
              <div class="audio-panel-section">
                <div class="audio-panel-title">
                  {{ $t('settings.musicQuality.text') }}
                </div>
                <div class="quality-options">
                  <button
                    v-for="option in musicQualityOptions"
                    :key="option.value"
                    class="quality-option"
                    :class="{ active: isCurrentQuality(option.value) }"
                    @click="setMusicQuality(option.value)"
                  >
                    {{ option.shortLabel }}
                  </button>
                </div>
              </div>
              <div class="audio-panel-section">
                <div class="audio-panel-header">
                  <div class="audio-panel-title">
                    {{ $t('settings.equalizer.title') }}
                  </div>
                  <div class="toggle compact">
                    <input
                      id="player-enable-equalizer"
                      v-model="equalizerEnabled"
                      type="checkbox"
                      name="player-enable-equalizer"
                    />
                    <label for="player-enable-equalizer"></label>
                  </div>
                </div>
                <div class="preset-options">
                  <button
                    v-for="preset in equalizerPresets"
                    :key="preset.value"
                    class="preset-option"
                    :class="{ active: equalizerPreset === preset.value }"
                    @click="setEqualizerPreset(preset.value)"
                  >
                    {{ $t(preset.label) }}
                  </button>
                </div>
                <div
                  class="player-equalizer-grid"
                  :class="{ disabled: !equalizerEnabled }"
                >
                  <div
                    v-for="(band, index) in equalizerBands"
                    :key="band.frequency"
                    class="player-equalizer-band"
                  >
                    <div class="player-equalizer-band-header">
                      <span>{{ band.label }}</span>
                      <span>{{
                        formatEqualizerGain(equalizerBandValues[index])
                      }}</span>
                    </div>
                    <input
                      :value="equalizerBandValues[index]"
                      :disabled="!equalizerEnabled"
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      @input="
                        updateEqualizerBand(index, Number($event.target.value))
                      "
                    />
                  </div>
                </div>
                <div class="audio-panel-footer">
                  <button class="preset-option" @click="resetEqualizer">
                    {{ $t('settings.equalizer.reset') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button-icon
            class="lyrics-button"
            title="歌词"
            style="margin-left: 12px"
            @click.native="toggleLyrics"
            ><svg-icon icon-class="arrow-up"
          /></button-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations, mapActions } from 'vuex';
import '@/assets/css/slider.css';

import ButtonIcon from '@/components/ButtonIcon.vue';
import VueSlider from 'vue-slider-component';
import { clearDB } from '@/utils/db';
import { goToListSource, hasListSource } from '@/utils/playList';
import { formatTrackTime } from '@/utils/common';

const equalizerBands = [
  { frequency: 31, label: '31Hz' },
  { frequency: 62, label: '62Hz' },
  { frequency: 125, label: '125Hz' },
  { frequency: 250, label: '250Hz' },
  { frequency: 500, label: '500Hz' },
  { frequency: 1000, label: '1kHz' },
  { frequency: 2000, label: '2kHz' },
  { frequency: 4000, label: '4kHz' },
  { frequency: 8000, label: '8kHz' },
  { frequency: 16000, label: '16kHz' },
];
const equalizerPresetsMap = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 1, 0, -1, -2, -2, -3],
  pop: [-1, 2, 4, 5, 3, 0, -1, -1, 1, 2],
  rock: [4, 3, 2, 1, -1, -2, 1, 3, 4, 5],
  vocal: [-2, -1, 1, 4, 5, 5, 3, 1, -1, -2],
};
const equalizerPresets = [
  { value: 'flat', label: 'settings.equalizer.presets.flat' },
  { value: 'bass', label: 'settings.equalizer.presets.bass' },
  { value: 'pop', label: 'settings.equalizer.presets.pop' },
  { value: 'rock', label: 'settings.equalizer.presets.rock' },
  { value: 'vocal', label: 'settings.equalizer.presets.vocal' },
];
const musicQualityOptions = [
  { value: '128000', shortLabel: '128K' },
  { value: '192000', shortLabel: '192K' },
  { value: '320000', shortLabel: '320K' },
  { value: 'flac', shortLabel: 'FLAC' },
  { value: '999000', shortLabel: 'Hi-Res' },
];

export default {
  name: 'Player',
  components: {
    ButtonIcon,
    VueSlider,
  },
  data() {
    return {
      mouseDownTarget: null,
      showAudioPanel: false,
      equalizerBands,
      equalizerPresets,
      musicQualityOptions,
    };
  },
  computed: {
    ...mapState(['player', 'settings', 'data']),
    currentTrack() {
      return this.player.currentTrack;
    },
    volume: {
      get() {
        return this.player.volume;
      },
      set(value) {
        this.player.volume = value;
      },
    },
    playing() {
      return this.player.playing;
    },
    audioSource() {
      return this.player._howler?._src.includes('kuwo.cn')
        ? '音源来自酷我音乐'
        : '';
    },
    equalizerEnabled: {
      get() {
        return this.settings.enableEqualizer || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableEqualizer',
          value,
        });
        this.player.applyEqualizerSettings();
      },
    },
    equalizerPreset() {
      return this.settings.equalizerPreset || 'flat';
    },
    equalizerBandValues() {
      return this.settings.equalizerBands || [...equalizerPresetsMap.flat];
    },
    qualityChipLabel() {
      const value = String(this.settings.musicQuality ?? 320000);
      const labels = {
        128000: this.$t('settings.musicQuality.low'),
        192000: this.$t('settings.musicQuality.medium'),
        320000: this.$t('settings.musicQuality.high'),
        flac: this.$t('settings.musicQuality.lossless'),
        999000: 'Hi-Res',
      };
      return labels[value] || labels[320000];
    },
  },
  mounted() {
    this.setupMediaControls();
    window.addEventListener('keydown', this.handleKeydown);
    document.addEventListener('pointerdown', this.handleDocumentPointerDown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
  },
  methods: {
    ...mapMutations(['toggleLyrics']),
    ...mapActions(['showToast', 'likeATrack']),
    handleClick(event) {
      if (event.target == this.mouseDownTarget) {
        this.showAudioPanel = false;
        this.toggleLyrics();
      }
    },
    handleMouseDown(event) {
      this.mouseDownTarget = event.target;
    },
    playPrevTrack() {
      this.player.playPrevTrack();
    },
    playOrPause() {
      this.player.playOrPause();
    },
    playNextTrack() {
      if (this.player.isPersonalFM) {
        this.player.playNextFMTrack();
      } else {
        this.player.playNextTrack();
      }
    },
    goToNextTracksPage() {
      if (this.player.isPersonalFM) return;
      this.$route.name === 'next'
        ? this.$router.go(-1)
        : this.$router.push({ name: 'next' });
    },
    formatTrackTime(value) {
      return formatTrackTime(value);
    },
    hasList() {
      return hasListSource();
    },
    goToList() {
      goToListSource();
    },
    goToAlbum() {
      if (this.player.currentTrack.al.id === 0) return;
      this.$router.push({ path: '/album/' + this.player.currentTrack.al.id });
    },
    goToArtist(id) {
      this.$router.push({ path: '/artist/' + id });
    },
    moveToFMTrash() {
      this.player.moveToFMTrash();
    },
    switchRepeatMode() {
      this.player.switchRepeatMode();
    },
    switchShuffle() {
      this.player.switchShuffle();
    },
    switchReversed() {
      this.player.switchReversed();
    },
    mute() {
      this.player.mute();
    },
    toggleAudioPanel() {
      this.showAudioPanel = !this.showAudioPanel;
    },
    handleDocumentPointerDown(event) {
      if (!this.showAudioPanel) return;
      if (this.$refs.audioTools?.contains(event.target)) return;
      this.showAudioPanel = false;
    },
    isCurrentQuality(value) {
      return String(this.settings.musicQuality ?? 320000) === String(value);
    },
    setMusicQuality(value) {
      if (this.isCurrentQuality(value)) return;
      this.$store.commit('changeMusicQuality', value);
      clearDB();
    },
    setEqualizerPreset(value) {
      this.$store.commit('updateSettings', {
        key: 'equalizerPreset',
        value,
      });
      this.$store.commit('updateSettings', {
        key: 'equalizerBands',
        value: [...equalizerPresetsMap[value]],
      });
      this.player.applyEqualizerSettings();
    },
    updateEqualizerBand(index, value) {
      const bands = [...this.equalizerBandValues];
      bands.splice(index, 1, value);
      this.$store.commit('updateSettings', {
        key: 'equalizerBands',
        value: bands,
      });
      this.$store.commit('updateSettings', {
        key: 'equalizerPreset',
        value: 'custom',
      });
      this.player.applyEqualizerSettings();
    },
    resetEqualizer() {
      this.$store.commit('updateSettings', {
        key: 'equalizerBands',
        value: [...equalizerPresetsMap.flat],
      });
      this.$store.commit('updateSettings', {
        key: 'equalizerPreset',
        value: 'flat',
      });
      this.player.applyEqualizerSettings();
    },
    formatEqualizerGain(value) {
      return `${value > 0 ? '+' : ''}${value}dB`;
    },

    setupMediaControls() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          this.playOrPause();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.playOrPause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          this.playPrevTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          this.playNextTrack();
        });
      }
    },

    handleKeydown(event) {
      switch (event.code) {
        case 'MediaPlayPause':
          this.playOrPause();
          break;
        case 'MediaTrackPrevious':
          this.playPrevTrack();
          break;
        case 'MediaTrackNext':
          this.playNextTrack();
          break;
        default:
          break;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.player {
  position: fixed;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 64px;
  backdrop-filter: saturate(180%) blur(30px);
  // background-color: rgba(255, 255, 255, 0.86);
  background-color: var(--color-navbar-bg);
  z-index: 100;
}

@supports (-moz-appearance: none) {
  .player {
    background-color: var(--color-body-bg);
  }
}

.progress-bar {
  margin-top: -6px;
  margin-bottom: -6px;
  width: 100%;
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 100%;
  padding: {
    right: 10vw;
    left: 10vw;
  }
}

@media (max-width: 1336px) {
  .controls {
    padding: 0 5vw;
  }
}

.blank {
  flex-grow: 1;
}

.playing {
  display: flex;
}

.playing .container {
  display: flex;
  align-items: center;
  img {
    height: 46px;
    border-radius: 5px;
    box-shadow: 0 6px 8px -2px rgba(0, 0, 0, 0.16);
    cursor: pointer;
    user-select: none;
  }
  .track-info {
    height: 46px;
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    .name {
      font-weight: 600;
      font-size: 16px;
      opacity: 0.88;
      color: var(--color-text);
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
    }
    .has-list {
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
    .artist {
      font-size: 12px;
      opacity: 0.58;
      color: var(--color-text);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
      span.ar {
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.middle-control-buttons {
  display: flex;
}

.middle-control-buttons .container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 8px;
  .button-icon {
    margin: 0 8px;
  }
  .play {
    height: 42px;
    width: 42px;
    .svg-icon {
      width: 24px;
      height: 24px;
    }
  }
}

.right-control-buttons {
  display: flex;
}

.right-control-buttons .container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  position: relative;
  .expand {
    margin-left: 24px;
    .svg-icon {
      height: 24px;
      width: 24px;
    }
  }
  .active .svg-icon {
    color: var(--color-primary);
  }
  .volume-control {
    margin-left: 4px;
    display: flex;
    align-items: center;
    .volume-bar {
      width: 84px;
    }
  }
  .audio-tools {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
  }
}

.like-button {
  margin-left: 16px;
}

.audio-chip {
  height: 30px;
  min-width: 42px;
  padding: 0 10px;
  border-radius: 999px;
  color: var(--color-text);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  transition: 0.2s;

  &:hover {
    background: var(--color-secondary-bg-for-transparent);
  }

  &.active {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
}

.quality-chip {
  min-width: 52px;
}

.eq-chip {
  width: 36px;
  padding: 0;
}

.eq-bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  height: 16px;

  span {
    width: 3px;
    border-radius: 999px;
    background: currentColor;

    &:nth-child(1) {
      height: 8px;
    }

    &:nth-child(2) {
      height: 14px;
    }

    &:nth-child(3) {
      height: 11px;
    }
  }
}

.audio-panel {
  position: absolute;
  right: 0;
  bottom: 52px;
  width: min(360px, 72vw);
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12),
      rgba(255, 255, 255, 0)
    ),
    var(--color-navbar-bg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  backdrop-filter: saturate(180%) blur(24px);
}

.audio-panel-section + .audio-panel-section {
  margin-top: 16px;
}

.audio-panel-title {
  margin-bottom: 10px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 700;
  opacity: 0.78;
}

.audio-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quality-options,
.preset-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quality-option,
.preset-option {
  padding: 6px 10px;
  border-radius: 999px;
  color: var(--color-text);
  background: var(--color-secondary-bg);
  font-size: 12px;
  font-weight: 600;
  transition: 0.2s;

  &:hover {
    transform: none;
    background: var(--color-primary-bg);
    color: var(--color-primary);
  }

  &.active {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
}

.player-equalizer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  &.disabled {
    opacity: 0.58;
  }
}

.player-equalizer-band {
  padding: 10px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.08);
}

.player-equalizer-band-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--color-text);
  font-size: 11px;
  font-weight: 600;
}

.player-equalizer-band input[type='range'] {
  width: 100%;
}

.audio-panel-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.toggle {
  margin: auto;
}

.toggle input {
  opacity: 0;
  position: absolute;
}

.toggle input + label {
  position: relative;
  display: inline-block;
  user-select: none;
  transition: 0.4s ease;
  height: 32px;
  width: 52px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
}

.toggle input + label:before {
  content: '';
  position: absolute;
  display: block;
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  height: 32px;
  width: 52px;
  top: 0;
  left: 0;
  border-radius: 8px;
}

.toggle input + label:after {
  content: '';
  position: absolute;
  display: block;
  box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.02), 0 4px 0 0 hsla(0, 0%, 0%, 0.01),
    0 4px 9px hsla(0, 0%, 0%, 0.08), 0 3px 3px hsla(0, 0%, 0%, 0.03);
  transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  background: #fff;
  height: 20px;
  width: 20px;
  top: 6px;
  left: 6px;
  border-radius: 6px;
}

.toggle input:checked + label:before {
  background: var(--color-primary-gradient);
}

.toggle input:checked + label:after {
  left: 26px;
}

.toggle.compact input + label {
  height: 26px;
  width: 44px;
}

.toggle.compact input + label:before {
  height: 26px;
  width: 44px;
}

.toggle.compact input + label:after {
  height: 16px;
  width: 16px;
  top: 5px;
  left: 5px;
}

.toggle.compact input:checked + label:after {
  left: 23px;
}

.button-icon.disabled {
  cursor: default;
  opacity: 0.38;
  &:hover {
    background: none;
  }
  &:active {
    transform: unset;
  }
}

@media (max-width: 960px) {
  .audio-panel {
    width: min(320px, 84vw);
  }

  .player-equalizer-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .player {
    height: auto;
    right: 14px;
    left: 14px;
    bottom: 14px;
    border: 1px solid rgba(128, 128, 128, 0.1);
    border-radius: 22px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.14);
    padding-bottom: calc(env(safe-area-inset-bottom) + 10px);
  }

  .progress-bar {
    margin-top: -4px;
    margin-bottom: 4px;
  }

  .controls {
    grid-template-columns: 1fr;
    row-gap: 10px;
    padding: 8px 14px 0;
  }

  .blank {
    display: none;
  }

  .playing .container {
    width: 100%;

    img {
      height: 48px;
      width: 48px;
    }

    .track-info {
      flex: 1;
      min-width: 0;
    }
  }

  .like-button {
    margin-left: 8px;
  }

  .middle-control-buttons .container {
    justify-content: center;
    padding: 0;

    .button-icon {
      margin: 0 10px;
    }
  }

  .right-control-buttons .container {
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .right-control-buttons .container .volume-control {
    margin-left: 0;
  }

  .right-control-buttons .container .audio-tools {
    margin-left: 0;
  }

  .lyrics-button {
    margin-left: 0 !important;
  }

  .audio-panel {
    right: auto;
    left: 0;
    bottom: 48px;
    width: min(360px, calc(100vw - 28px));
  }
}

@media (max-width: 560px) {
  .player {
    right: 10px;
    left: 10px;
    bottom: calc(env(safe-area-inset-bottom) + 74px);
    border-radius: 20px;
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }

  .controls {
    row-gap: 8px;
    padding: 8px 12px 0;
  }

  .playing .container {
    align-items: center;

    img {
      height: 42px;
      width: 42px;
      border-radius: 10px;
    }

    .track-info {
      margin-left: 10px;

      .name {
        font-size: 14px;
      }

      .artist {
        font-size: 11px;
      }
    }
  }

  .like-button {
    display: none;
  }

  .middle-control-buttons .container {
    .button-icon {
      margin: 0 8px;
    }

    .play {
      height: 40px;
      width: 40px;
    }
  }

  .right-control-buttons .container {
    gap: 6px;
  }

  .right-control-buttons .container .queue-button,
  .right-control-buttons .container .reversed-button,
  .right-control-buttons .container .volume-control {
    display: none;
  }

  .audio-chip {
    height: 28px;
    font-size: 11px;
  }

  .quality-chip {
    min-width: 48px;
    padding: 0 8px;
  }

  .eq-chip {
    width: 32px;
  }

  .audio-panel {
    bottom: 42px;
    width: calc(100vw - 20px);
    max-width: 360px;
  }
}
</style>
