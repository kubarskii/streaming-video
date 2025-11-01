/**
 * Video Player FSM Tests
 * Tests for the video player finite state machine
 */
import { describe, it, expect } from 'vitest';
import {
    videoPlayerFSMConfig,
    createVideoPlayerFSM,
    isPlayableState,
    isPlayingState,
    isLoadingState,
    isErrorState,
} from '../videoPlayerFSM';
import { PLAYER_STATES, PLAYER_EVENTS } from '../../../../shared/config/videoPlayer.constants';

describe('videoPlayerFSM', () => {
    describe('State Machine Configuration', () => {
        it('should have correct initial state', () => {
            expect(videoPlayerFSMConfig.initial).toBe(PLAYER_STATES.IDLE);
        });

        it('should have all required states defined', () => {
            const expectedStates = [
                PLAYER_STATES.IDLE,
                PLAYER_STATES.LOADING,
                PLAYER_STATES.READY,
                PLAYER_STATES.PLAYING,
                PLAYER_STATES.PAUSED,
                PLAYER_STATES.BUFFERING,
                PLAYER_STATES.SEEKING,
                PLAYER_STATES.ENDED,
                PLAYER_STATES.ERROR,
            ];

            expectedStates.forEach(state => {
                expect(videoPlayerFSMConfig.states[state]).toBeDefined();
            });
        });
    });

    describe('State Transitions', () => {
        it('should transition from IDLE to LOADING on PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            expect(fsm.getState()).toBe(PLAYER_STATES.IDLE);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.LOADING);
        });

        it('should transition from IDLE to READY on LOADED_METADATA event', () => {
            const fsm = createVideoPlayerFSM();
            expect(fsm.getState()).toBe(PLAYER_STATES.IDLE);
            
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            expect(fsm.getState()).toBe(PLAYER_STATES.READY);
        });

        it('should transition from LOADING to READY on LOADED_METADATA event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.LOADING);
            
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            expect(fsm.getState()).toBe(PLAYER_STATES.READY);
        });

        it('should transition from READY to PLAYING on PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            expect(fsm.getState()).toBe(PLAYER_STATES.READY);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should transition from PLAYING to PAUSED on PAUSE event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.PAUSE);
            expect(fsm.getState()).toBe(PLAYER_STATES.PAUSED);
        });

        it('should transition from PAUSED to PLAYING on PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.PAUSE);
            expect(fsm.getState()).toBe(PLAYER_STATES.PAUSED);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should transition from PLAYING to BUFFERING on WAITING event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
        });

        it('should transition from BUFFERING to PLAYING on CAN_PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
            
            fsm.send(PLAYER_EVENTS.CAN_PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should transition from PLAYING to SEEKING on SEEK event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
        });

        it('should transition from SEEKING to PLAYING on SEEKED event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
            
            fsm.send(PLAYER_EVENTS.SEEKED);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should transition from PLAYING to ENDED on ENDED event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.ENDED);
            expect(fsm.getState()).toBe(PLAYER_STATES.ENDED);
        });

        it('should transition from ENDED to PLAYING on PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.ENDED);
            expect(fsm.getState()).toBe(PLAYER_STATES.ENDED);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should transition to ERROR on ERROR event from any playable state', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.ERROR);
            expect(fsm.getState()).toBe(PLAYER_STATES.ERROR);
        });

        it('should transition from ERROR to LOADING on RETRY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.ERROR);
            expect(fsm.getState()).toBe(PLAYER_STATES.ERROR);
            
            fsm.send(PLAYER_EVENTS.RETRY);
            expect(fsm.getState()).toBe(PLAYER_STATES.LOADING);
        });
    });

    describe('State Helpers', () => {
        describe('isPlayableState', () => {
            it('should return true for playable states', () => {
                const playableStates = [
                    PLAYER_STATES.READY,
                    PLAYER_STATES.PLAYING,
                    PLAYER_STATES.PAUSED,
                    PLAYER_STATES.BUFFERING,
                    PLAYER_STATES.SEEKING,
                ];

                playableStates.forEach(state => {
                    expect(isPlayableState(state)).toBe(true);
                });
            });

            it('should return false for non-playable states', () => {
                const nonPlayableStates = [
                    PLAYER_STATES.IDLE,
                    PLAYER_STATES.LOADING,
                    PLAYER_STATES.ENDED,
                    PLAYER_STATES.ERROR,
                ];

                nonPlayableStates.forEach(state => {
                    expect(isPlayableState(state)).toBe(false);
                });
            });
        });

        describe('isPlayingState', () => {
            it('should return true only for PLAYING state', () => {
                expect(isPlayingState(PLAYER_STATES.PLAYING)).toBe(true);
            });

            it('should return false for all other states', () => {
                const otherStates = [
                    PLAYER_STATES.IDLE,
                    PLAYER_STATES.LOADING,
                    PLAYER_STATES.READY,
                    PLAYER_STATES.PAUSED,
                    PLAYER_STATES.BUFFERING,
                    PLAYER_STATES.SEEKING,
                    PLAYER_STATES.ENDED,
                    PLAYER_STATES.ERROR,
                ];

                otherStates.forEach(state => {
                    expect(isPlayingState(state)).toBe(false);
                });
            });
        });

        describe('isLoadingState', () => {
            it('should return true for loading states', () => {
                const loadingStates = [
                    PLAYER_STATES.IDLE,
                    PLAYER_STATES.LOADING,
                    PLAYER_STATES.BUFFERING,
                ];

                loadingStates.forEach(state => {
                    expect(isLoadingState(state)).toBe(true);
                });
            });

            it('should return false for non-loading states', () => {
                const nonLoadingStates = [
                    PLAYER_STATES.READY,
                    PLAYER_STATES.PLAYING,
                    PLAYER_STATES.PAUSED,
                    PLAYER_STATES.SEEKING,
                    PLAYER_STATES.ENDED,
                    PLAYER_STATES.ERROR,
                ];

                nonLoadingStates.forEach(state => {
                    expect(isLoadingState(state)).toBe(false);
                });
            });
        });

        describe('isErrorState', () => {
            it('should return true only for ERROR state', () => {
                expect(isErrorState(PLAYER_STATES.ERROR)).toBe(true);
            });

            it('should return false for all other states', () => {
                const otherStates = [
                    PLAYER_STATES.IDLE,
                    PLAYER_STATES.LOADING,
                    PLAYER_STATES.READY,
                    PLAYER_STATES.PLAYING,
                    PLAYER_STATES.PAUSED,
                    PLAYER_STATES.BUFFERING,
                    PLAYER_STATES.SEEKING,
                    PLAYER_STATES.ENDED,
                ];

                otherStates.forEach(state => {
                    expect(isErrorState(state)).toBe(false);
                });
            });
        });
    });

    describe('Edge Cases', () => {
        it('should stay in PLAYING state on CAN_PLAY event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            fsm.send(PLAYER_EVENTS.CAN_PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });

        it('should allow multiple SEEK events while seeking', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
            
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
        });

        it('should stay in BUFFERING after SEEKED event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
            
            fsm.send(PLAYER_EVENTS.SEEKED);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
        });

        it('should transition from BUFFERING to PAUSED on PAUSE event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
            
            fsm.send(PLAYER_EVENTS.PAUSE);
            expect(fsm.getState()).toBe(PLAYER_STATES.PAUSED);
        });

        it('should transition from SEEKING to BUFFERING on WAITING event', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
            
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
        });
    });

    describe('Invalid Transitions', () => {
        it('should not transition when event is not defined for current state', () => {
            const fsm = createVideoPlayerFSM();
            expect(fsm.getState()).toBe(PLAYER_STATES.IDLE);
            
            // PAUSE event is not defined for IDLE state
            fsm.send(PLAYER_EVENTS.PAUSE);
            expect(fsm.getState()).toBe(PLAYER_STATES.IDLE);
        });

        it('should not allow PLAY from ERROR state', () => {
            const fsm = createVideoPlayerFSM();
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            fsm.send(PLAYER_EVENTS.ERROR);
            expect(fsm.getState()).toBe(PLAYER_STATES.ERROR);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.ERROR);
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle full playback lifecycle', () => {
            const fsm = createVideoPlayerFSM();
            
            // Initial load
            expect(fsm.getState()).toBe(PLAYER_STATES.IDLE);
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            expect(fsm.getState()).toBe(PLAYER_STATES.READY);
            
            // Start playing
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            // Buffer
            fsm.send(PLAYER_EVENTS.WAITING);
            expect(fsm.getState()).toBe(PLAYER_STATES.BUFFERING);
            fsm.send(PLAYER_EVENTS.CAN_PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            // Seek
            fsm.send(PLAYER_EVENTS.SEEK);
            expect(fsm.getState()).toBe(PLAYER_STATES.SEEKING);
            fsm.send(PLAYER_EVENTS.SEEKED);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            // Pause
            fsm.send(PLAYER_EVENTS.PAUSE);
            expect(fsm.getState()).toBe(PLAYER_STATES.PAUSED);
            
            // Resume
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            // End
            fsm.send(PLAYER_EVENTS.ENDED);
            expect(fsm.getState()).toBe(PLAYER_STATES.ENDED);
        });

        it('should handle error and recovery', () => {
            const fsm = createVideoPlayerFSM();
            
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
            
            // Error occurs
            fsm.send(PLAYER_EVENTS.ERROR);
            expect(fsm.getState()).toBe(PLAYER_STATES.ERROR);
            
            // Retry
            fsm.send(PLAYER_EVENTS.RETRY);
            expect(fsm.getState()).toBe(PLAYER_STATES.LOADING);
            
            // Recover
            fsm.send(PLAYER_EVENTS.LOADED_METADATA);
            expect(fsm.getState()).toBe(PLAYER_STATES.READY);
            
            fsm.send(PLAYER_EVENTS.PLAY);
            expect(fsm.getState()).toBe(PLAYER_STATES.PLAYING);
        });
    });
});

