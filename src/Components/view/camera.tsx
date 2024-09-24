import React, { MouseEventHandler, MutableRefObject, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import { Button, ButtonGroup, FormControlLabel, Switch } from "@mui/material";
import { VideoUtil } from "Components/utils/video";
import { Client } from '@stomp/stompjs'; // @stomp/stompjs 라이브러리 임포트

interface IDeviceProps {
    info: MediaDeviceInfo;
    isActive: boolean;
    onClick: MouseEventHandler<HTMLDivElement>;
}

const Camera = (props: IDeviceProps) => {
    return (
        <div className={props.isActive ? "device-item active" : "device-item"} onClick={props.onClick}>
            <div className="icon"><FontAwesomeIcon icon={faCamera} /></div>
            <div className="name">{props.info.label.split('(')[0]}</div>
        </div>
    );
}

const CameraView = () => {
    const videoRef = useRef<HTMLVideoElement>() as MutableRefObject<HTMLVideoElement>;
    const [cameraId, setCameraId] = useState<string>();
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>();
    const [isCaptured, setIsCaptured] = useState(false);
    const [constraints, setConstraints] = useState<MediaStreamConstraints>({ video: true, audio: true });

    const videoUtil = new VideoUtil(videoRef, {
        mirror: true
    });

    // STOMP 클라이언트 선언
    const stompClient = new Client({
        brokerURL: 'wss://test2-zeta-drab.vercel.app', // WebSocket URL
        onConnect: (frame) => {
            console.log('Connected: ' + frame);

            // ICE 후보 수신
            stompClient.subscribe('/topic/peer/iceCandidate', (message) => {
                const iceCandidate = JSON.parse(message.body);
                console.log("ICE Candidate received: ", iceCandidate);
                // WebRTC 연결에 ICE 후보 추가
            });

            // 오퍼 수신
            stompClient.subscribe('/topic/peer/offer', (message) => {
                const offer = JSON.parse(message.body);
                console.log("Offer received: ", offer);
                // WebRTC 연결에 오퍼 추가
            });

            // 응답 수신
            stompClient.subscribe('/topic/peer/answer', (message) => {
                const answer = JSON.parse(message.body);
                console.log("Answer received: ", answer);
                // WebRTC 연결에 응답 추가
            });
        },
        onStompError: (frame) => {
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        }
    });

    const getUserMedia = function (constraints?: MediaStreamConstraints) {
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                videoRef.current.srcObject = stream;
                resolve(stream);
            }).catch(error => {
                console.error(error);
                reject('카메라 접근을 허용해주세요.');
            });
        });
    };

    useEffect(() => {
        setIsCaptured(false);

        getUserMedia(constraints).then((stream) => {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const cameras = devices.filter(e => e.kind === 'videoinput');
                setCameras(cameras);
                setCameraId(cameras[0]?.deviceId);
            });
        });
    }, []);

    useEffect(() => {
        // STOMP 클라이언트 연결
        stompClient.activate();
        return () => {
            stompClient.deactivate();
        };
    }, []);

    function playVideo() {
        setIsCaptured(false);
        videoUtil.play();
    }

    function savePicture() {
        setIsCaptured(true);
        videoUtil.saveImage();
    }

    function downloadPicture() {
        setIsCaptured(true);
        videoUtil.downloadImage();
    }

    return (
        <div className="container card">
            <div className="card-body flex-column">
                <div className="section">
                    <div className="section-title">카메라 목록</div>
                    <div className="device-list">
                        {cameras?.length === 0 ? (
                            <div>사용 가능한 카메라가 없습니다.</div>
                        ) : (
                            cameras?.map((device, index) => {
                                return <Camera key={'video-' + index} info={device}
                                               isActive={cameraId === device.deviceId}
                                               onClick={(e) => {
                                                   setCameraId(device.deviceId);
                                                   getUserMedia({
                                                       video: {
                                                           deviceId: device.deviceId,
                                                       }
                                                   }).then(stream => {
                                                       // 선택한 카메라에서 비디오 스트림 처리
                                                   });
                                               }} />;
                            })
                        )}
                    </div>
                </div>
                <div className="section">
                    <div className="section-btn-group">
                        <div className="title">카메라 옵션</div>
                        <div>
                            <FormControlLabel labelPlacement="end"
                                              control={<Switch onChange={event => {
                                                  videoUtil && videoUtil.setMirror(event.target.checked);
                                              }}
                                                               defaultChecked={videoUtil.getMirror()} />}
                                              label="좌우 반전" />
                            <ButtonGroup>
                                <Button disabled={isCaptured} onClick={savePicture}>촬영</Button>
                                <Button disabled={!isCaptured} onClick={playVideo}>재촬영</Button>
                                <Button disabled={!isCaptured} onClick={downloadPicture}>사진 다운로드</Button>
                            </ButtonGroup>
                        </div>
                    </div>
                </div>
                <div className="section">
                    <video id="camera" autoPlay={true} ref={videoRef}></video>
                </div>
            </div>
        </div>
    );
};

export default CameraView;
