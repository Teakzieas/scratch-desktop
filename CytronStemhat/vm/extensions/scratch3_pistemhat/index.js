const formatMessage = require('format-message');
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const RenderedTarget = require('../../sprites/rendered-target');
const path = window.require('path');
const fs = window.require('fs');

const gpio = window.require(path.join(__static, 'gpiolib.node'))
const stemhat = window.require(path.join(__static, 'stemhat.node'));
const device = stemhat.I2ccreateDevice("/dev/i2c-1", 0x08);


const i2c = window.require(path.join(__static, 'i2c-bus.js'));
const oled = window.require(path.join(__static, 'oled.js'));
const font = window.require(path.join(__static, 'oled-font.js'));





//////////////////////////////////////////////////////////////////
//TESTING FOR Logs
//////////////////////////////////////////////////////////////////
function writeLog(message) {
    const logFilePath = path.join(__static, 'log'); // Path to the 'log' file

    fs.appendFile(logFilePath, `${message}\n`, 'utf8', (err) => {
        if (err) {
            console.error('Error appending to log file:', err);
        } else {
            console.log('Message appended to log file:', message);
        }
    });
}
//////////////////////////////////////////////////////////////////

var cachedBuzzerValue = 0


//////////////////////////////////////////////////////////////////
//OLED MODULE INIT
//////////////////////////////////////////////////////////////////
const i2cBus = i2c.openSync(1);
const opts = {
    width: 128,
    height: 64,
    address: 0x3C
};

oledDisplay = new oled(i2cBus, opts);
oledDisplay.clearDisplay();
oledDisplay.turnOnDisplay();
//////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////
//AHT20 MODULE
//////////////////////////////////////////////////////////////////
var cachedHumidityValue = -1;
var lastReadTime2 = 0;
var cachedTemperatureValue = -1;
var lastReadTime3 = 0;

AHT20isReading = false;

async function GetAHT20() {
    if (AHT20isReading) {
        return; // Exit if a read is already in progress
    }

    AHT20isReading = true; // Mark as running
    try {
        const result = await stemhat.AHT20ReadAsync();
        cachedTemperatureValue = result.temperature.toFixed(1);
        cachedHumidityValue = result.humidity.toFixed(1);

    } catch (err) {
        console.error("Error in GetAHT20:", err);
    } finally {
        AHT20isReading = false; // Reset the flag once done
    }
}
//////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////
//UltraSonic MODULE
//////////////////////////////////////////////////////////////////
var cachedUltrasonicValue = -1;
var lastReadTime1 = 0;

var UltrasonicisReading = false;

async function GetUltrasonic() {
    if (UltrasonicisReading) {
        return; // Exit if a read is already in progress
    }
    UltrasonicisReading = true; // Mark as running
    try {
        const result = await stemhat.UltrasonicReadAsync();
        cachedUltrasonicValue = result;
    } catch (err) {
        console.error("Error in GetUltrasonic:", err);
    } finally {
        UltrasonicisReading = false; // Reset the flag once done
    }
}

//////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////
//APDS9960 MODULE
//////////////////////////////////////////////////////////////////
// Set the mode of the APDS-9960 sensor to proximity mode
let APDSMode = 0;
const DEVICE_ADDR = 0x39;
const GESTURE_DATA_REG = 0xFC;
const GFLVL_REG = 0xAE;
const GMODE_REG = 0xAB;
const ENABLE_REG = 0x80;
const PROXIMITY_REG = 0x9C;
const GESTURE_MODE_REG = 0xAB;

const APDS9960_GESTURE_THRESHOLD_OUT = 10;
const APDS9960_GESTURE_SENSITIVITY_1 = 50;
const APDS9960_GESTURE_SENSITIVITY_2 = 20;

let gesture_ud_delta = 0, gesture_lr_delta = 0;
let gesture_ud_count = 0, gesture_lr_count = 0;
let gesture_near_count = 0, gesture_far_count = 0;
let gesture_state = 0;
let gesture_motion = "NO_GESTURE";

//Motor Controller
function scaleTo255(value) {
    if (value < 0 || value > 100) {
        throw new Error("Value must be between 0 and 100.");
    }
    return Math.round((value / 100) * 255);
}


/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
const blockIconURI = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgdmVyc2lvbj0iMS4xIgogICB3aWR0aD0iODAwIgogICBoZWlnaHQ9IjgwMCIKICAgaWQ9InN2ZzM0MTAiCiAgIGlua3NjYXBlOnZlcnNpb249IjAuOTEgcjEzNzI1IgogICBzb2RpcG9kaTpkb2NuYW1lPSJyYXNwYmVycnktcGktbG9nb20uc3ZnIj4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGEzNDQ0Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZGVmcwogICAgIGlkPSJkZWZzMzQ0MiIgLz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEiCiAgICAgb2JqZWN0dG9sZXJhbmNlPSIxMCIKICAgICBncmlkdG9sZXJhbmNlPSIxMCIKICAgICBndWlkZXRvbGVyYW5jZT0iMTAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEzODEiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iOTY1IgogICAgIGlkPSJuYW1lZHZpZXczNDQwIgogICAgIHNob3dncmlkPSJmYWxzZSIKICAgICBmaXQtbWFyZ2luLWxlZnQ9Ijc1IgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9Ijc1IgogICAgIGlua3NjYXBlOnpvb209IjAuNzg4NjIwNDgiCiAgICAgaW5rc2NhcGU6Y3g9IjMyMC44NjU1IgogICAgIGlua3NjYXBlOmN5PSIzNjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjQxMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIwIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzM0MTAiIC8+CiAgPHBhdGgKICAgICBkPSJtIDI2Ny40MjYxOSw0My42MTUxMzggYyAtMy42MTkzLDAuMTEyMzE5IC03LjUxNzE1LDEuNDQ5MzI3IC0xMS45Mzc1LDQuOTM3NSAtMTAuODI2OTYsLTQuMTc2MyAtMjEuMzI3MDksLTUuNjI3MTg5IC0zMC43MTg3NSwyLjg3NSAtMTQuNDkzODYsLTEuODgwNzU4IC0xOS4yMTAyOSwyLjAwMDc0NCAtMjIuNzgxMjUsNi41MzEyNSAtMy4xODI1NSwtMC4wNjU4NyAtMjMuODE4ODUsLTMuMjcyMDcgLTMzLjI4MTI1LDEwLjg0Mzc1IC0yMy43ODE2NSwtMi44MTM0MiAtMzEuMjk2NzgsMTMuOTg3ODggLTIyLjc4MTI1LDI5LjY1NjI1IC00Ljg1NjkxLDcuNTE4OTUyIC05Ljg4OTUxLDE0Ljk0NzIzMiAxLjQ2ODc1LDI5LjI4MTI1MiAtNC4wMTgwMSw3Ljk4MzUxIC0xLjUyNzQzLDE2LjY0NDAzIDcuOTM3NSwyNy4xMjUgLTIuNDk3ODYsMTEuMjIyNiAyLjQxMjA3LDE5LjE0MDg2IDExLjIxODc1LDI1LjMxMjUgLTEuNjQ3MDksMTUuMzU3NTYgMTQuMDgzNSwyNC4yODc0MyAxOC43ODEyNSwyNy40Njg3NSAxLjgwMzY3LDguOTQ4NjggNS41NjI5MSwxNy4zOTI3IDIzLjUzMTI1LDIyLjA2MjUgMi45NjMyMywxMy4zMzYxIDEzLjc2MjA2LDE1LjYzOTA2IDI0LjIxODc1LDE4LjQzNzUgLTM0LjU2MTkzLDIwLjA4OTU0IC02NC4yMDA2Nyw0Ni41MjI2NiAtNjQsMTExLjM3NSBsIC01LjA2MjUsOS4wMzEyNSBjIC0zOS42MzA4NywyNC4xMDIyOSAtNzUuMjg1Mjk5LDEwMS41NjYyNiAtMTkuNTMxMjUsMTY0LjUzMTI1IDMuNjQxODcsMTkuNzA4MzggOS43NDk1OSwzMy44NjM5NiAxNS4xODc1LDQ5LjUzMTI1IDguMTMzODMsNjMuMTMwNTggNjEuMjE3NjMsOTIuNjkxNjEgNzUuMjE4NzUsOTYuMTg3NSAyMC41MTY1MywxNS42MjgxMiA0Mi4zNjgxOCwzMC40NTY3MiA3MS45Mzc1LDQwLjg0Mzc1IDI3Ljg3NTE1LDI4Ljc0OTQ2IDU4LjA3Mzg4LDM5LjcwNjQgODguNDM3NSwzOS42ODc1IDAuNDQ1MTUsLTIuOGUtNCAwLjg5ODUzLDAuMDA1IDEuMzQzNzUsMCAzMC4zNjM2MywwLjAxODkgNjAuNTYyMzUsLTEwLjkzODA0IDg4LjQzNzUsLTM5LjY4NzUgMjkuNTY5MzIsLTEwLjM4NzAzIDUxLjQyMDk3LC0yNS4yMTU2MyA3MS45Mzc1LC00MC44NDM3NSAxNC4wMDExMiwtMy40OTU4OSA2Ny4wODQ5MiwtMzMuMDU2OTIgNzUuMjE4NzUsLTk2LjE4NzUgNS40Mzc5MSwtMTUuNjY3MjkgMTEuNTQ1NjIsLTI5LjgyMjg3IDE1LjE4NzUsLTQ5LjUzMTI1IDU1Ljc1NDA0LC02Mi45NjQ5OSAyMC4wOTk2MSwtMTQwLjQyODk2IC0xOS41MzEyNSwtMTY0LjUzMTI1IGwgLTUuMDYyNSwtOS4wMzEyNSBjIDAuMjAwNjcsLTY0Ljg1MjM0IC0yOS40MzgwNywtOTEuMjg1NDYgLTY0LC0xMTEuMzc1IDEwLjQ1NjY5LC0yLjc5ODQ0IDIxLjI1NTUyLC01LjEwMTQgMjQuMjE4NzUsLTE4LjQzNzUgMTcuOTY4MzQsLTQuNjY5OCAyMS43Mjc1OCwtMTMuMTEzODIgMjMuNTMxMjUsLTIyLjA2MjUgNC42OTc3NSwtMy4xODEzMiAyMC40MjgzNCwtMTIuMTExMTkgMTguNzgxMjUsLTI3LjQ2ODc1IDguODA2NjgsLTYuMTcxNjQgMTMuNzE2NjEsLTE0LjA4OTkgMTEuMjE4NzUsLTI1LjMxMjUgOS40NjQ5NCwtMTAuNDgwOTcgMTEuOTU1NSwtMTkuMTQxNDkgNy45Mzc1LC0yNy4xMjUgMTEuMzU4MjUsLTE0LjMzNDAyIDYuMzI1NjYsLTIxLjc2MjMgMS40Njg3NSwtMjkuMjgxMjUyIDguNTE1NTMsLTE1LjY2ODM3IDEuMDAwNCwtMzIuNDY5NjcgLTIyLjc4MTI1LC0yOS42NTYyNSAtOS40NjI0LC0xNC4xMTU4MiAtMzAuMDk4NywtMTAuOTA5NjE1IC0zMy4yODEyNSwtMTAuODQzNzUgLTMuNTcwOTYsLTQuNTMwNTA2IC04LjI4NzM5LC04LjQxMjAwOCAtMjIuNzgxMjUsLTYuNTMxMjUgLTkuMzkxNjYsLTguNTAyMTg5IC0xOS44OTE3OSwtNy4wNTEzIC0zMC43MTg3NSwtMi44NzUgLTEyLjg1OTIsLTEwLjE0NzQxMyAtMjEuMzcyMjYsLTIuMDEzMjk2IC0zMS4wOTM3NSwxLjA2MjUgLTE1LjU3Mzg1LC01LjA4Nzc3OCAtMTkuMTMzMDIsMS44ODA5MDggLTI2Ljc4MTI1LDQuNzE4NzUgLTE2Ljk3NTI1LC0zLjU4ODA3NiAtMjIuMTM1Niw0LjIyMzUzMiAtMzAuMjgxMjUsMTIuNDY4NzUgbCAtOS40Njg3NSwtMC4xODc1IGMgLTI1LjYxMDU0LDE1LjA5MzExIC0zOC4zMzM3OCw0NS44MjU1MDIgLTQyLjg0Mzc1LDYxLjYyNTAwMiAtNC41MTIwNiwtMTUuODAxOTggLTE3LjIwNjQ3LC00Ni41MzQ1NDIgLTQyLjgxMjUsLTYxLjYyNTAwMiBsIC05LjQ2ODc1LDAuMTg3NSBjIC04LjE0NTY1LC04LjI0NTIxOCAtMTMuMzA2LC0xNi4wNTY4MjcgLTMwLjI4MTI1LC0xMi40Njg3NSAtNy42NDgyMywtMi44Mzc4NDIgLTExLjIwNzQsLTkuODA2NTI3IC0yNi43ODEyNSwtNC43MTg3NSAtNi4zNzk3MywtMi4wMTg0OTEgLTEyLjI0NjY3LC02LjIxNDQyOCAtMTkuMTU2MjUsLTYgeiIKICAgICBzdHlsZT0iZmlsbDojMDAwMDAwIgogICAgIGlkPSJwYXRoMzQxMiIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxwYXRoCiAgICAgZD0ibSAyMTYuNDQzMDMsMTEwLjAxNDQ3IGMgNjcuOTQ3NjcsMzUuMDMxMzYgMTA3LjQ0Njg5LDYzLjM2ODk3IDEyOS4wODcxNyw4Ny41MDQ0NyAtMTEuMDgyMzUsNDQuNDE3NTkgLTY4Ljg5NjM4LDQ2LjQ0NDY0IC05MC4wMzU1OSw0NS4xOTg1OCA0LjMyODQyLC0yLjAxNDc0IDcuOTM5ODgsLTQuNDI3NzggOS4yMjA1MSwtOC4xMzU3NCAtNS4zMDQ0OSwtMy43Njk4MSAtMjQuMTEyODksLTAuMzk3MTkgLTM3LjI0MzYzLC03Ljc3NDE2IDUuMDQ0MDcsLTEuMDQ0OTkgNy40MDM0OCwtMi4wNjMwMiA5Ljc2Mjg5LC01Ljc4NTQyIC0xMi40MDU3MSwtMy45NTY3IC0yNS43Njg2MiwtNy4zNjY0MiAtMzMuNjI3NzUsLTEzLjkyMTE2IDQuMjQxMjUsMC4wNTI0IDguMjAxMTYsMC45NDg4IDEzLjc0MDM3LC0yLjg5MjcxIC0xMS4xMTE3LC01Ljk4ODE5IC0yMi45NjkxMSwtMTAuNzMzNTEgLTMyLjE4MTM5LC0xOS44ODczOCA1Ljc0NTIxLC0wLjE0MDYzIDExLjkzOTQ1LC0wLjA1NjggMTMuNzQwMzcsLTIuMTY5NTMgLTEwLjE3MDQ0LC02LjMwMDY4IC0xOC43NTEyNCwtMTMuMzA3ODcgLTI1Ljg1MzU5LC0yMC45NzIxNSA4LjAzOTk4LDAuOTcwNTIgMTEuNDM1MjgsMC4xMzQ3OCAxMy4zNzg3OCwtMS4yNjU1NiAtNy42ODc4LC03Ljg3NDE5IC0xNy40MTc1NiwtMTQuNTIzMTkgLTIyLjA1NjkxLC0yNC4yMjY0NCA1Ljk2OTYsMi4wNTc0OCAxMS40MzEyNSwyLjg0NTA2IDE1LjM2NzUyLC0wLjE4MDc5IC0yLjYxMjM3LC01Ljg5MzQ2IC0xMy44MDU0MiwtOS4zNjk2MiAtMjAuMjQ4OTcsLTIzLjE0MTY4IDYuMjg0MzYsMC42MDkzOCAxMi45NDk2MSwxLjM3MTExIDE0LjI4Mjc1LDAgLTIuOTIyMywtMTEuODg4NTYgLTcuOTI3NDUsLTE4LjU3MDAzMiAtMTIuODM2MzksLTI1LjQ5MjAwMiAxMy40NTAwNCwtMC4xOTk3MyAzMy44Mjc3NSwwLjA1MjMgMzIuOTA0NTcsLTEuMDg0NzcgbCAtOC4zMTY1NCwtOC40OTczMyBjIDEzLjEzNzYxLC0zLjUzNzI1IDI2LjU4MDY1LDAuNTY4MTYgMzYuMzM5NjYsMy42MTU4OCA0LjM4MTg2LC0zLjQ1NzY4IC0wLjA3NzYsLTcuODI5OTggLTUuNDIzODMsLTEyLjI5NDAxIDExLjE2NDk2LDEuNDkwNjQgMjEuMjUzODIsNC4wNTczOSAzMC4zNzM0NSw3LjU5MzM2IDQuODcyMzgsLTQuMzk5MzMgLTMuMTYzODksLTguNzk4NjYgLTcuMDUwOTgsLTEzLjE5Nzk5IDE3LjI0OTM2LDMuMjcyNTcgMjQuNTU3MTYsNy44NzA2OCAzMS44MTk4MSwxMi40NzQ4MSA1LjI2OTM1LC01LjA1MDggMC4zMDE2NiwtOS4zNDMzIC0zLjI1NDMsLTEzLjc0MDM2OSAxMy4wMDU2Niw0LjgxNzA0OSAxOS43MDQ3OCwxMS4wMzU1NDkgMjYuNzU3NTYsMTcuMTc1NDU5IDIuMzkxMTksLTMuMjI3MDUgNi4wNzQ5NCwtNS41OTI0IDEuNjI3MTUsLTEzLjM3ODc4IDkuMjM0MTYsNS4zMjI3MyAxNi4xODkyNiwxMS41OTUwNiAyMS4zMzM3NCwxOC42MjE4MiA1LjcxMzM2LC0zLjYzNzk0IDMuNDAzODcsLTguNjEzMDIgMy40MzUwOSwtMTMuMTk3OTkgOS41OTY2NSw3LjgwNjUyIDE1LjY4Njg3LDE2LjExMzk1IDIzLjE0MTY4LDI0LjIyNjQ1IDEuNTAxNjksLTEuMDkzNDQgMi44MTY2MSwtNC44MDE3MSAzLjk3NzQ3LC0xMC42NjY4NyAyMi44OTUzOSwyMi4yMTE4MTIgNTUuMjQ1OTEsNzguMTU4MjQyIDguMzE2NTQsMTAwLjM0MDg2MiAtMzkuOTE4NzcsLTMyLjk0NzE2IC04Ny42MTYxMywtNTYuODg3NTMgLTE0MC40NzcyMSwtNzQuODQ4ODYgeiIKICAgICBzdHlsZT0iZmlsbDojNzVhOTI4IgogICAgIGlkPSJwYXRoMzQxNCIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxwYXRoCiAgICAgZD0ibSA1NzYuOTc2MDYsMTEwLjAxNDQ3IGMgLTY3Ljk0NzY3LDM1LjAzMTM2IC0xMDcuNDQ2ODksNjMuMzY4OTcgLTEyOS4wODcxNyw4Ny41MDQ0NyAxMS4wODIzNSw0NC40MTc1OSA2OC44OTYzOCw0Ni40NDQ2NCA5MC4wMzU1OSw0NS4xOTg1OCAtNC4zMjg0MiwtMi4wMTQ3NCAtNy45Mzk4OCwtNC40Mjc3OCAtOS4yMjA1MSwtOC4xMzU3NCA1LjMwNDQ5LC0zLjc2OTgxIDI0LjExMjg5LC0wLjM5NzE5IDM3LjI0MzYzLC03Ljc3NDE2IC01LjA0NDA3LC0xLjA0NDk5IC03LjQwMzQ4LC0yLjA2MzAyIC05Ljc2Mjg5LC01Ljc4NTQyIDEyLjQwNTcxLC0zLjk1NjcgMjUuNzY4NjIsLTcuMzY2NDIgMzMuNjI3NzUsLTEzLjkyMTE2IC00LjI0MTI2LDAuMDUyNCAtOC4yMDExNiwwLjk0ODggLTEzLjc0MDM3LC0yLjg5MjcxIDExLjExMTY5LC01Ljk4ODE5IDIyLjk2OTExLC0xMC43MzM1MSAzMi4xODEzOSwtMTkuODg3MzggLTUuNzQ1MjEsLTAuMTQwNjMgLTExLjkzOTQ1LC0wLjA1NjggLTEzLjc0MDM3LC0yLjE2OTUzIDEwLjE3MDQ0LC02LjMwMDY4IDE4Ljc1MTI0LC0xMy4zMDc4NyAyNS44NTM1OSwtMjAuOTcyMTUgLTguMDM5OTgsMC45NzA1MiAtMTEuNDM1MjgsMC4xMzQ3OCAtMTMuMzc4NzgsLTEuMjY1NTYgNy42ODc3OSwtNy44NzQxOSAxNy40MTc1NiwtMTQuNTIzMTkgMjIuMDU2OTEsLTI0LjIyNjQ0IC01Ljk2OTYxLDIuMDU3NDggLTExLjQzMTI1LDIuODQ1MDYgLTE1LjM2NzUyLC0wLjE4MDc5IDIuNjEyMzcsLTUuODkzNDYgMTMuODA1NDEsLTkuMzY5NjIgMjAuMjQ4OTcsLTIzLjE0MTY4IC02LjI4NDM2LDAuNjA5MzggLTEyLjk0OTYxLDEuMzcxMTEgLTE0LjI4Mjc2LDAgMi45MjIzMSwtMTEuODg4NTYgNy45Mjc0NiwtMTguNTcwMDIyIDEyLjgzNjQsLTI1LjQ5MjAwMiAtMTMuNDUwMDQsLTAuMTk5NzMgLTMzLjgyNzc1LDAuMDUyNCAtMzIuOTA0NTcsLTEuMDg0NzcgbCA4LjMxNjU0LC04LjQ5NzMzIGMgLTEzLjEzNzYyLC0zLjUzNzI1IC0yNi41ODA2NSwwLjU2ODE2IC0zNi4zMzk2NiwzLjYxNTg4IC00LjM4MTg2LC0zLjQ1NzY4IDAuMDc3NiwtNy44Mjk5OCA1LjQyMzgzLC0xMi4yOTQwMSAtMTEuMTY0OTYsMS40OTA2NCAtMjEuMjUzODIsNC4wNTczOSAtMzAuMzczNDUsNy41OTMzNiAtNC44NzIzOCwtNC4zOTkzMyAzLjE2Mzg5LC04Ljc5ODY2IDcuMDUwOTgsLTEzLjE5Nzk5IC0xNy4yNDkzNiwzLjI3MjU3IC0yNC41NTcxNiw3Ljg3MDY4IC0zMS44MTk4MSwxMi40NzQ4MSAtNS4yNjkzNSwtNS4wNTA4IC0wLjMwMTY2LC05LjM0MzMgMy4yNTQzLC0xMy43NDAzNjkgLTEzLjAwNTY2LDQuODE3MDQ5IC0xOS43MDQ3OCwxMS4wMzU1NDkgLTI2Ljc1NzU2LDE3LjE3NTQ1OSAtMi4zOTExOSwtMy4yMjcwNSAtNi4wNzQ5NCwtNS41OTI0IC0xLjYyNzE1LC0xMy4zNzg3OCAtOS4yMzQxNiw1LjMyMjczIC0xNi4xODkyNiwxMS41OTUwNiAtMjEuMzMzNzQsMTguNjIxODIgLTUuNzEzMzYsLTMuNjM3OTQgLTMuNDAzODcsLTguNjEzMDIgLTMuNDM1MDksLTEzLjE5Nzk5IC05LjU5NjY1LDcuODA2NTIgLTE1LjY4Njg3LDE2LjExMzk1IC0yMy4xNDE2OCwyNC4yMjY0NSAtMS41MDE2OSwtMS4wOTM0NCAtMi44MTY2MSwtNC44MDE3MSAtMy45Nzc0NywtMTAuNjY2ODcgLTIyLjg5NTM5LDIyLjIxMTgxMiAtNTUuMjQ1OTEsNzguMTU4MjQyIC04LjMxNjU0LDEwMC4zNDA4NjIgMzkuOTE4NzcsLTMyLjk0NzE2IDg3LjYxNjEzLC01Ni44ODc1MyAxNDAuNDc3MjEsLTc0Ljg0ODg2IHoiCiAgICAgc3R5bGU9ImZpbGw6Izc1YTkyOCIKICAgICBpZD0icGF0aDM0MTYiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gNDc4Ljk5NzUzLDU2Mi4zMTk5MyBhIDgxLjM5MDExMSw3NS4wNTE3NjIgMCAwIDEgLTE2Mi43ODAyMiwwIDgxLjM5MDExMSw3NS4wNTE3NjIgMCAxIDEgMTYyLjc4MDIyLDAgeiIKICAgICBzdHlsZT0iZmlsbDojYmMxMTQyIgogICAgIGlkPSJwYXRoMzQxOCIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxwYXRoCiAgICAgZD0iTSAzNTAuNTA1MjEsMzQ3LjkyMTMxIEEgNzIuOTk4ODM5LDg2LjEyOTY3NCAzNC4wMzQyMjYgMCAxIDI1NS41MzczNyw0OTEuNjMzNTcgNzIuOTk4ODM5LDg2LjEyOTY3NCAzNC4wMzQyMjYgMSAxIDM1MC41MDUyMSwzNDcuOTIxMzEgWiIKICAgICBzdHlsZT0iZmlsbDojYmMxMTQyIgogICAgIGlkPSJwYXRoMzQyMCIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxwYXRoCiAgICAgZD0iTSA0NDEuNTM3MzksMzQzLjkyMTMxIEEgODYuMTI5Njc0LDcyLjk5ODgzOSA1NS45NjU3NzQgMCAwIDUzNi41MDUyMyw0ODcuNjMzNTcgODYuMTI5Njc0LDcyLjk5ODgzOSA1NS45NjU3NzQgMSAwIDQ0MS41MzczOSwzNDMuOTIxMzEgWiIKICAgICBzdHlsZT0iZmlsbDojYmMxMTQyIgogICAgIGlkPSJwYXRoMzQyMiIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxwYXRoCiAgICAgZD0ibSAxODEuOTYxNDQsMzg0LjA0NjY5IGMgMzYuNDE0MjIsLTkuNzU2OTIgMTIuMjkxNTksMTUwLjYzNjUxIC0xNy4zMzMzOCwxMzcuNDc1NzcgLTMyLjU4Njc3LC0yNi4yMTI2OCAtNDMuMDgzMDcsLTEwMi45NzU0MyAxNy4zMzMzOCwtMTM3LjQ3NTc3IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MjQiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gNjAyLjcyOTQ3LDM4Mi4wNDY2OSBjIC0zNi40MTQyMiwtOS43NTY5MiAtMTIuMjkxNiwxNTAuNjM2NTEgMTcuMzMzMzgsMTM3LjQ3NTc3IDMyLjU4Njc3LC0yNi4yMTI2OCA0My4wODMwNywtMTAyLjk3NTQzIC0xNy4zMzMzOCwtMTM3LjQ3NTc3IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MjYiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gNDc5LjAyMjc3LDI2Mi42MTIyOSBjIDYyLjgzNDg2LC0xMC42MTAxMyAxMTUuMTE1OTQsMjYuNzIyMjkgMTEzLjAxMTM4LDk0Ljg1Nzk2IC0yLjA2NjkzLDI2LjEyMTEyIC0xMzYuMTU4NzIsLTkwLjk2OTA3IC0xMTMuMDExMzgsLTk0Ljg1Nzk2IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MjgiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gMzA1LjQxMDk0LDI2MC42MTIyOSBjIC02Mi44MzQ4NiwtMTAuNjEwMTMgLTExNS4xMTU5NCwyNi43MjIyOSAtMTEzLjAxMTM4LDk0Ljg1Nzk2IDIuMDY2OTMsMjYuMTIxMTIgMTM2LjE1ODcyLC05MC45NjkwNyAxMTMuMDExMzgsLTk0Ljg1Nzk2IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MzAiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gMzk1LjY3MDUxLDI0NC43MTQ1NyBjIC0zNy41MDI1OSwtMC45NzU0OCAtNzMuNDk1NDgsMjcuODM0MTggLTczLjU4MTU4LDQ0LjU0NDQzIC0wLjEwNDYyLDIwLjMwNDI2IDI5LjY1MTIsNDEuMDkyNjYgNzMuODM3MjYsNDEuNjIwMzUgNDUuMTIzMDUsMC4zMjMyMSA3My45MTU2MSwtMTYuNjQwNDkgNzQuMDYxMSwtMzcuNTk0MDkgMC4xNjQ4NCwtMjMuNzM5OTYgLTQxLjAzODc5LC00OC45Mzc0NCAtNzQuMzE2NzgsLTQ4LjU3MDY5IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MzIiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gMzk3Ljk2MDU2LDY2MS4wNzU2NCBjIDMyLjY5NzQ0LC0xLjQyNzExIDc2LjU3MDgzLDEwLjUzMTk2IDc2LjY1NjgsMjYuMzk1OTggMC41NDI3LDE1LjQwNTIgLTM5Ljc4OTY5LDUwLjIxMDU1IC03OC44MjYzNCw0OS41Mzc2NSAtNDAuNDI3MjksMS43NDM5MSAtODAuMDY5MDgsLTMzLjExNTU5IC03OS41NDk1MSwtNDUuMTk4NTkgLTAuNjA1MDYsLTE3LjcxNTkzIDQ5LjIyNiwtMzEuNTQ3OTYgODEuNzE5MDUsLTMwLjczNTA0IHoiCiAgICAgc3R5bGU9ImZpbGw6I2JjMTE0MiIKICAgICBpZD0icGF0aDM0MzQiCiAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIgLz4KICA8cGF0aAogICAgIGQ9Im0gMjc3LjE4OTkzLDU2Ny4wNjI1OCBjIDIzLjI3OTEsMjguMDQ1NzMgMzMuODkwNjYsNzcuMzE4OTkgMTQuNDYzNTUsOTEuODQzNTMgLTE4LjM3OTE3LDExLjA4Nzg0IC02My4wMTIyOCw2LjUyMTYyIC05NC43MzYyNCwtMzkuMDUxNTcgLTIxLjM5NTA1LC0zOC4yNDE2OCAtMTguNjM3NTgsLTc3LjE1NjYzIC0zLjYxNTg5LC04OC41ODkyNCAyMi40NjQ0MywtMTMuNjg0MjkgNTcuMTczNDMsNC43OTkwMiA4My44ODg1OCwzNS43OTcyOCB6IgogICAgIHN0eWxlPSJmaWxsOiNiYzExNDIiCiAgICAgaWQ9InBhdGgzNDM2IgogICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIC8+CiAgPHBhdGgKICAgICBkPSJtIDUxNC4wNzIwOSw1NTguMTcwNjYgYyAtMjUuMTg2ODIsMjkuNTAxNjUgLTM5LjIxMjI3LDgzLjMwOTUxIC0yMC44Mzc4NSwxMDAuNjQyOCAxNy41NjgyOCwxMy40NjM2MSA2NC43MjkyLDExLjU4MTYyIDk5LjU2NTY2LC0zNi43NTU3NCAyNS4yOTU5OSwtMzIuNDY0NzEgMTYuODIwMTMsLTg2LjY4MjI1IDIuMzcwNzcsLTEwMS4wNzUxMSAtMjEuNDY0MDgsLTE2LjYwMjEzIC01Mi4yNzY5MSw0LjY0NDg5IC04MS4wOTg1OCwzNy4xODgwNSB6IgogICAgIHN0eWxlPSJmaWxsOiNiYzExNDIiCiAgICAgaWQ9InBhdGgzNDM4IgogICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIC8+Cjwvc3ZnPgo='

/**
 * Class for the Raspberry Pi STEMHAT blocks in Scratch 3.0
 * @constructor
 */
class Scratch3PiSTEMHATBlocks {
    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME() {
        return 'Raspberry Pi STEMHAT';
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID() {
        return 'pistemhat';
    }

    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }


    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo() {
        return {
            id: Scratch3PiSTEMHATBlocks.EXTENSION_ID,
            name: Scratch3PiSTEMHATBlocks.EXTENSION_NAME,
            blockIconURI: blockIconURI,
            blocks: [
                {
                    opcode: 'when_buttonPressed',
                    text: formatMessage({
                        id: 'pistemhat.when_buttonPressed',
                        default: 'when Button [BUTTON] is pressed',
                        description: 'when a button is pressed'
                    }),
                    blockType: BlockType.HAT,
                    arguments: {
                        BUTTON: {
                            type: ArgumentType.STRING,
                            menu: 'BUTTONs',
                            defaultValue: '5'
                        }
                    }
                },
                {
                    opcode: 'set_LED',
                    text: formatMessage({
                        id: 'pistemhat.set_LED',
                        default: 'set LED [LED] to [COLOUR]',
                        description: 'set the led to spesific color'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        LED: {
                            type: ArgumentType.STRING,
                            menu: 'LEDs',
                            defaultValue: '0'
                        },
                        COLOUR: {
                            type: ArgumentType.COLOR
                        }
                    }
                },
                {
                    opcode: 'set_BUZZER',
                    text: formatMessage({
                        id: 'pistemhat.set_BUZZER',
                        default: 'set Buzzer Frequency to [FREQ]',
                        description: 'set the buzzer to state'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        FREQ: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'stop_BUZZER',
                    text: formatMessage({
                        id: 'pistemhat.stop_BUZZER',
                        default: 'Stop Buzzer',
                        description: 'Stop the buzzer to state'
                    }),
                    blockType: BlockType.COMMAND,

                },
                {
                    opcode: 'set_MOTOR',
                    text: formatMessage({
                        id: 'pistemhat.set_MOTOR',
                        default: 'set [MOTOR] to [POWER]%',
                        description: 'set motor to power'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        MOTOR: {
                            type: ArgumentType.STRING,
                            menu: 'MOTORs',
                            defaultValue: 'Both Motors'
                        },
                        POWER: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'set_MOTOR_EACH',
                    text: formatMessage({
                        id: 'pistemhat.set_MOTOR_EACH',
                        default: 'set Left Motor to [POWERM1]% and Right Motor to [POWERM2]%',
                        description: 'set motor power to each motor'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        POWERM1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        },
                        POWERM2: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'stop_MOTOR',
                    text: formatMessage({
                        id: 'pistemhat.stop_MOTOR',
                        default: 'stop [MOTOR]',
                        description: 'Stop motor'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        MOTOR: {
                            type: ArgumentType.STRING,
                            menu: 'MOTORs',
                            defaultValue: 'Both Motors'
                        }
                    }
                },
                {
                    opcode: 'set_SERVO',
                    text: formatMessage({
                        id: 'pistemhat.set_SERVO',
                        default: 'set Servo [SERVO] position to [DEGREE]°',
                        description: 'set servo to position'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        SERVO: {
                            type: ArgumentType.STRING,
                            menu: 'SERVOs',
                            defaultValue: '1'
                        },
                        DEGREE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '90'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Text',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Text',
                        default: 'set OLED text to [TEXT] at X[X1], Y[Y1] size[SIZE]  [WRAP]',
                        description: 'set servo to position'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Hello'
                        },
                        X1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        SIZE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1',
                            menu: 'SIZEs',
                        },
                        WRAP: {
                            type: ArgumentType.String,
                            menu: 'WRAPs',
                            defaultValue: 'Wrap'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Pixel',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Pixel',
                        default: 'set OLED Pixel at X[X1], Y[Y1] to [STATE]',
                        description: 'set servo to position'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        STATE: {
                            type: ArgumentType.STRING,
                            menu: 'STATEs',
                            defaultValue: 'ON'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Line',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Line',
                        default: 'draw line on OLED at X1[X1], Y1[Y1] to X2[X2], Y2[Y2]',
                        description: 'draw a circle on the OLED display'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        X2: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        },
                        Y2: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Circle',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Circle',
                        default: 'draw circle on OLED at center X[X1], Y[Y1] with radius [RADIUS] [SOLID]',
                        description: 'draw a circle on the OLED display'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        },
                        Y1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        },
                        RADIUS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        },
                        SOLID: {
                            type: ArgumentType.String,
                            menu: 'SOLIDs',
                            defaultValue: 'Solid'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Rectangle',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Rectangle',
                        default: 'draw rectangle on OLED at X1[X1], Y1[Y1] Height[HEIGHT] Width[WIDTH] [SOLID]',
                        description: 'draw a rectangle on the OLED display'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y1: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        HEIGHT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        },
                        WIDTH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        },
                        SOLID: {
                            type: ArgumentType.String,
                            menu: 'SOLIDs',
                            defaultValue: 'Solid'
                        }
                    }
                },
                {
                    opcode: 'set_OLED_Sprite',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Sprite',
                        default: 'draw [SPRITE] on OLED at X[X], Y[Y] [SCALE]',
                        description: 'draw a sprite on the OLED display'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        SCALE: {
                            type: ArgumentType.String,
                            menu: 'SCALEs',
                            defaultValue: 'Fit'
                        },
                        SPRITE: {
                            type: ArgumentType.STRING,
                            menu: 'SPRITEs',
                            defaultValue: 'Sprite1'
                        }
                    }


                },
                {
                    opcode: 'set_OLED_Scroll',
                    text: formatMessage({
                        id: 'pistemhat.set_OLED_Scroll',
                        default: 'scroll OLED to [DIR] from Row [START] to Row[END]',
                        description: 'scroll the OLED display'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        DIR: {
                            type: ArgumentType.String,
                            menu: 'DIRs',
                            defaultValue: 'right'
                        },
                        START: {
                            type: ArgumentType.String,
                            menu: 'ROWs',
                            defaultValue: '0'
                        },
                        END: {
                            type: ArgumentType.String,
                            menu: 'ROWs',
                            defaultValue: '7'
                        }
                    }
                },
                {
                    opcode: 'stop_OLED_Scroll',
                    text: formatMessage({
                        id: 'pistemhat.stop_OLED_Scroll',
                        default: 'stop OLED scroll',
                        description: 'stop the OLED scroll'
                    }),
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'reset_OLED_section',
                    text: formatMessage({
                        id: 'pistemhat.reset_section_OLED',
                        default: 'clear spesific section in OLED x[X] y[Y] Height[HEIGHT] Width[WIDTH]',
                        description: 'clear spesific section in OLED'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        X: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        Y: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        },
                        HEIGHT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        },
                        WIDTH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '10'
                        }
                    }
                },

                {
                    opcode: 'reset_OLED',
                    text: formatMessage({
                        id: 'pistemhat.reset_OLED',
                        default: 'clear OLED',
                        description: 'set OLED'
                    }),
                    blockType: BlockType.COMMAND,
                },
                {
                    opcode: 'get_button',
                    text: formatMessage({
                        id: 'pistemhat.get_button',
                        default: 'get Button [BUTTON] state',
                        description: 'get the button pressed state'
                    }),
                    blockType: BlockType.BOOLEAN,
                    arguments: {
                        BUTTON: {
                            type: ArgumentType.STRING,
                            menu: 'BUTTONs',
                            defaultValue: '5'
                        }
                    }
                },
                {
                    opcode: 'get_analog',
                    text: formatMessage({
                        id: 'pistemhat.get_analog',
                        default: 'get Analog [ANALOG]',
                        description: 'get the analog reading 0-255'
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        ANALOG: {
                            type: ArgumentType.STRING,
                            menu: 'ANALOGs',
                            defaultValue: 'AN0'
                        }
                    }
                },
                {
                    opcode: 'get_temp',
                    text: formatMessage({
                        id: 'pistemhat.get_temp',
                        default: 'get Temperature in Celsius',
                        description: 'get the Temperature'
                    }),
                    blockType: BlockType.REPORTER

                },
                {
                    opcode: 'get_humidity',
                    text: formatMessage({
                        id: 'pistemhat.get_humidity',
                        default: 'get Humidity in percentage',
                        description: 'get the Humidity'
                    }),
                    blockType: BlockType.REPORTER

                },
                {
                    opcode: 'get_ultrasonic',
                    text: formatMessage({
                        id: 'pistemhat.get_ultrasonic',
                        default: 'get Ultrasonic Sensor in cm',
                        description: 'get Ultrasonic Distance in CM'
                    }),
                    blockType: BlockType.REPORTER

                },
                {
                    opcode: 'Set_APDS9960_Mode',
                    text: formatMessage({
                        id: 'pistemhat.Set_APDS9960_Mode',
                        default: 'Set APDS9960 to [MODE]',
                        description: 'Set APDS9960 Mode'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        MODE: {
                            type: ArgumentType.String,
                            menu: 'MODEs',
                            defaultValue: 'Proximity'
                        }
                    }
                },
                {
                    opcode: 'get_proximity',
                    text: formatMessage({
                        id: 'pistemhat.get_proximity',
                        default: 'get Proximity Sensor (0-255)',
                        description: 'get Proximity Distance in 0-255'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'get_gesture',
                    text: formatMessage({
                        id: 'pistemhat.get_gesture',
                        default: 'get Gesture',
                        description: 'get Gesture'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'get_color',
                    text: formatMessage({
                        id: 'pistemhat.get_color',
                        default: 'get Color',
                        description: 'get Color'
                    }),
                    blockType: BlockType.REPORTER
                }
            ],
            menus: {
                LEDs: {
                    acceptReporters: true,
                    items: ['0', '1']
                },
                STATEs: {
                    acceptReporters: true,
                    items: ['ON', 'OFF']
                },
                MOTORs: {
                    acceptReporters: false,
                    items: ['Left Motor', 'Right Motor', 'Both Motors']
                },
                SERVOs: {
                    acceptReporters: true,
                    items: ['1', '2', '3', '4']
                },
                ROWs:
                {
                    acceptReporters: true,
                    items: ['1', '2', '3', '4', '5', '6', '7']
                },

                BUTTONs: {
                    acceptReporters: true,
                    items: ['5', '6']
                },
                ANALOGs: {
                    acceptReporters: false,
                    items: ['AN0', 'AN1', 'Light Sensor', 'Vin Voltage']
                },
                WRAPs: {
                    acceptReporters: false,
                    items: ['Warp', 'No Wrap']
                },
                SOLIDs: {
                    acceptReporters: false,
                    items: ['Solid', 'Outline']
                },
                DIRs: {
                    acceptReporters: false,
                    items: ['right', 'left']
                },
                SCALEs: {
                    acceptReporters: false,
                    items: ['Fit', 'Fill', 'No Scaling']
                },
                SPRITEs: {
                    acceptReporters: false,
                    items: 'getSpriteMenu'
                },
                SIZEs: {
                    acceptReporters: false,
                    items: ['1', '2', '3', '4']
                },
                MODEs: {
                    acceptReporters: false,
                    items: ['Proximity', 'Gesture', 'Color']
                },
            }
        };
    }
    getSpriteMenu() {
        // Ensure the runtime is available
        try {
            if (!this.runtime || !this.runtime.targets) {
                console.warn('Runtime or targets not available.');
                return ["No Sprite Found"];
            }

            // Map through the targets to extract their names
            const sprites = this.runtime.targets
                .filter(target => target.getName() !== "Stage") // Exclude the "Stage"
                .map(target => target.getName());

            if (sprites.length === 0) {
                return ["No Sprite Found"];
            } else {
                return sprites;
            }

        } catch (e) {
            console.error(e);
            return ["No Sprite Found"];
        }

    }


    when_buttonPressed(args) {


        const pin = Cast.toNumber(args.BUTTON);
        const state = gpio.get(pin, 0, 2); // Get state of pin, leave pin as input/output, leave pull state
        let binary = 0;
        return state == binary
    }

    set_LED(args) {
        const colour = Cast.toRgbColorList(args.COLOUR);
        var register1 = 0x00;
        var register2 = 0x00;
        var register3 = 0x00;
        if (args.LED === '0') {
            register1 = 0x09;
            register2 = 0x0A;
            register3 = 0x0B;

        } else if (args.LED === '1') {
            register1 = 0x0C;
            register2 = 0x0D;
            register3 = 0x0E;
        }
        stemhat.I2cwriteToRegister(device, register1, colour[0]);
        stemhat.I2cwriteToRegister(device, register2, colour[1]);
        stemhat.I2cwriteToRegister(device, register3, colour[2]);
    }

    set_BUZZER(args) {
        const frequency = Cast.toNumber(args.FREQ);
        if (cachedBuzzerValue !== frequency) {
            stemhat.I2cwriteToRegister(device, 0x13, Math.floor(frequency / 10));
            cachedBuzzerValue = frequency;
        }


    }
    stop_BUZZER(args) {
        stemhat.I2cwriteToRegister(device, 0x13, 0);
        cachedBuzzerValue = -1;
    }

    stop_MOTOR(args) {
        var M1A = 0x05;
        var M1B = 0x06;
        var M2A = 0x07;
        var M2B = 0x08;

        if (Cast.toString(args.MOTOR) == "Left Motor") {
            stemhat.I2cwriteToRegister(device, M1A, 0);
            stemhat.I2cwriteToRegister(device, M1B, 0);
        }
        else if (Cast.toString(args.MOTOR) == "Right Motor") {
            stemhat.I2cwriteToRegister(device, M2A, 0);
            stemhat.I2cwriteToRegister(device, M2B, 0);
        }
        else if (Cast.toString(args.MOTOR) == "Both Motors") {
            stemhat.I2cwriteToRegister(device, M1A, 0);
            stemhat.I2cwriteToRegister(device, M1B, 0);
            stemhat.I2cwriteToRegister(device, M2A, 0);
            stemhat.I2cwriteToRegister(device, M2B, 0);
        }

    }

    set_MOTOR(args) {
        var M1A = 0x05;
        var M1B = 0x06;
        var M2A = 0x07;
        var M2B = 0x08;
        var MotorSpeed = Cast.toNumber(args.POWER);

        if (MotorSpeed > 100) { MotorSpeed = 100 }
        else if (MotorSpeed < -100) { MotorSpeed = -100 }

        if (MotorSpeed > 0) {
            var MotorSpeed1 = MotorSpeed
            if (Cast.toString(args.MOTOR) == "Left Motor") {
                stemhat.I2cwriteToRegister(device, M1A, scaleTo255(MotorSpeed1));
                stemhat.I2cwriteToRegister(device, M1B, 0);

            }
            else if (Cast.toString(args.MOTOR) == "Right Motor") {
                stemhat.I2cwriteToRegister(device, M2A, scaleTo255(MotorSpeed1));
                stemhat.I2cwriteToRegister(device, M2B, 0);
            }
            else if (Cast.toString(args.MOTOR) == "Both Motors") {
                stemhat.I2cwriteToRegister(device, M1A, scaleTo255(MotorSpeed1));
                stemhat.I2cwriteToRegister(device, M1B, 0);
                stemhat.I2cwriteToRegister(device, M2A, scaleTo255(MotorSpeed1));
                stemhat.I2cwriteToRegister(device, M2B, 0);
            }
        }
        else if (MotorSpeed < 0) {
            var MotorSpeed1 = MotorSpeed * -1
            if (Cast.toString(args.MOTOR) == "Left Motor") {
                stemhat.I2cwriteToRegister(device, M1A, 0);
                stemhat.I2cwriteToRegister(device, M1B, scaleTo255(MotorSpeed1));

            }
            else if (Cast.toString(args.MOTOR) == "Right Motor") {
                stemhat.I2cwriteToRegister(device, M2A, 0);
                stemhat.I2cwriteToRegister(device, M2B, scaleTo255(MotorSpeed1));
            }
            else if (Cast.toString(args.MOTOR) == "Both Motors") {
                stemhat.I2cwriteToRegister(device, M1A, 0);
                stemhat.I2cwriteToRegister(device, M1B, scaleTo255(MotorSpeed1));
                stemhat.I2cwriteToRegister(device, M2A, 0);
                stemhat.I2cwriteToRegister(device, M2B, scaleTo255(MotorSpeed1));
            }
        }
        else {
            stemhat.I2cwriteToRegister(device, M1A, 0);
            stemhat.I2cwriteToRegister(device, M1B, 0);
            stemhat.I2cwriteToRegister(device, M2A, 0);
            stemhat.I2cwriteToRegister(device, M2B, 0);
        }
    }

    set_MOTOR_EACH(args) {
        var M1A = 0x05;
        var M1B = 0x06;
        var M2A = 0x07;
        var M2B = 0x08;
        var MotorSpeed1 = Cast.toNumber(args.POWERM1);
        var MotorSpeed2 = Cast.toNumber(args.POWERM2);

        if (MotorSpeed1 > 100) { MotorSpeed1 = 100 }
        else if (MotorSpeed1 < -100) { MotorSpeed1 = -100 }

        if (MotorSpeed2 > 100) { MotorSpeed2 = 100 }
        else if (MotorSpeed2 < -100) { MotorSpeed2 = -100 }

        if (MotorSpeed1 > 0) {
            stemhat.I2cwriteToRegister(device, M1A, scaleTo255(MotorSpeed1));
            stemhat.I2cwriteToRegister(device, M1B, 0);
        }
        else if (MotorSpeed1 < 0) {
            MotorSpeed1 = MotorSpeed1 * -1
            stemhat.I2cwriteToRegister(device, M1A, 0);
            stemhat.I2cwriteToRegister(device, M1B, scaleTo255(MotorSpeed1));
        }
        else {
            stemhat.I2cwriteToRegister(device, M1A, 0);
            stemhat.I2cwriteToRegister(device, M1B, 0);
        }


        if (MotorSpeed2 > 0) {
            stemhat.I2cwriteToRegister(device, M2A, scaleTo255(MotorSpeed2));
            stemhat.I2cwriteToRegister(device, M2B, 0);
        }
        else if (MotorSpeed2 < 0) {
            MotorSpeed2 = MotorSpeed2 * -1
            stemhat.I2cwriteToRegister(device, M2A, 0);
            stemhat.I2cwriteToRegister(device, M2B, scaleTo255(MotorSpeed2));
        }
        else {
            stemhat.I2cwriteToRegister(device, M2A, 0);
            stemhat.I2cwriteToRegister(device, M2B, 0);
        }
    }

    set_SERVO(args) {
        var Servo1 = 0x01;
        var Servo2 = 0x02;
        var Servo3 = 0x03;
        var Servo4 = 0x04;

        var degree = Cast.toNumber(args.DEGREE);
        if (degree > 180) { degree = 180 }
        else if (degree < 0) { degree = 0 }

        if (Cast.toString(args.SERVO) == "1") {
            stemhat.I2cwriteToRegister(device, Servo1, degree);
        }
        if (Cast.toString(args.SERVO) == "2") {
            stemhat.I2cwriteToRegister(device, Servo2, degree);
        }
        if (Cast.toString(args.SERVO) == "3") {
            stemhat.I2cwriteToRegister(device, Servo3, degree);
        }
        if (Cast.toString(args.SERVO) == "4") {
            stemhat.I2cwriteToRegister(device, Servo4, degree);
        }

    }

    async set_OLED_Text(args) {
        const text = Cast.toString(args.TEXT);
        const x = Cast.toNumber(args.X1);
        const y = Cast.toNumber(args.Y1);
        const size = Cast.toNumber(args.SIZE);
        const wrap = Cast.toString(args.WRAP);
        var wrap1 = true;
        if (wrap == "Wrap") {
            wrap1 = true;
        }
        else {
            wrap1 = false;
        }
        await oledDisplay.setCursor(x, y);
        await oledDisplay.writeString(font, size, text, 1, wrap1);
    }

    async set_OLED_Pixel(args) {
        const x = Cast.toNumber(args.X1);
        const y = Cast.toNumber(args.Y1);
        const state = Cast.toString(args.STATE);
        var state1 = 0;
        if (state == "ON") {
            state1 = 1;
        }
        else {
            state1 = 0;
        }
        await oledDisplay.drawPixel([[x, y, state1]]);


    }

    async set_OLED_Circle(args) {
        const centerX = Cast.toNumber(args.X1);
        const centerY = Cast.toNumber(args.Y1);
        const radius = Cast.toNumber(args.RADIUS);
        const solid = Cast.toString(args.SOLID);
        var solid1 = 0;
        if (solid == "Solid") {
            solid1 = 1
        }
        await oledDisplay.drawCircle(centerX, centerY, radius, 1, solid1);
    }

    async set_OLED_Line(args) {
        const x1 = Cast.toNumber(args.X1);
        const y1 = Cast.toNumber(args.Y1);
        const x2 = Cast.toNumber(args.X2);
        const y2 = Cast.toNumber(args.Y2);
        await oledDisplay.drawLine(x1, y1, x2, y2, 1);
    }

    async set_OLED_Rectangle(args) {
        const x = Cast.toNumber(args.X1);
        const y = Cast.toNumber(args.Y1);
        const width = Cast.toNumber(args.WIDTH);
        const height = Cast.toNumber(args.HEIGHT);
        const solid = Cast.toString(args.SOLID);
        var solid1 = 0;
        if (solid == "Solid") {
            solid1 = 1;
        }
        await oledDisplay.drawRect(x, y, width, height, 1, solid1);
    }

    async set_OLED_Sprite(args) {
        try {
            const x = Cast.toNumber(args.X);
            const y = Cast.toNumber(args.Y);
            const Scale = Cast.toString(args.SCALE);
            const spriteName = Cast.toString(args.SPRITE);

            if (Scale == "Fit") {
                await oledDisplay.DrawSpriteBitmap(this.runtime, spriteName, x, y, 2);
            }
            else if (Scale == "Fill") {
                await oledDisplay.DrawSpriteBitmap(this.runtime, spriteName, x, y, 1);
            }
            else {
                await oledDisplay.DrawSpriteBitmap(this.runtime, spriteName, x, y, 0);
            }
        } catch (error) {
            console.log("Error: " + error);
        }
    }

    async stop_OLED_Scroll(args) {
        await oledDisplay.stopScroll();
    }

    async set_OLED_Scroll(args) {
        const dir = Cast.toString(args.DIR);
        const top = Cast.toNumber(args.TOP);
        const end = Cast.toNumber(args.END);
        await oledDisplay.startScroll(dir, top, end);
    }

    async reset_OLED_section(args) {
        const x = Cast.toNumber(args.X);
        const y = Cast.toNumber(args.Y);
        const height = Cast.toNumber(args.HEIGHT);
        const width = Cast.toNumber(args.WIDTH);

        await oledDisplay.drawRect(x, y, width, height, 0, 1);
    }


    async reset_OLED(args) {
        await oledDisplay.clearDisplay();
    }

    get_button(args) {
        const pin = Cast.toNumber(args.BUTTON);
        const state = gpio.get(pin, 0, 2); // Get state of pin, leave pin as input/output, leave pull state
        let binary = 0;
        return state == binary
    }


    get_analog(args) {
        var register = 0x00;

        if (Cast.toString(args.ANALOG) == "AN0") {
            register = 0x0F;
        }
        if (Cast.toString(args.ANALOG) == "AN1") {
            register = 0x10;
        }
        if (Cast.toString(args.ANALOG) == "Light Sensor") {
            register = 0x11;
        }
        if (Cast.toString(args.ANALOG) == "Vin Voltage") {
            register = 0x12;
        }



        let readings = [];
        for (let i = 0; i < 3; i++) {
            let value1 = stemhat.I2creadFromRegister(device, register);
            readings.push(value1);
        }
        let mean = readings.reduce((a, b) => a + b, 0) / readings.length;
        let threshold = 5;
        let validReadings = readings.filter(value => Math.abs(value - mean) <= threshold);
        return validReadings[0];
    }

    get_temp(args) {
        const currentTime = Date.now();
        if (currentTime - lastReadTime3 > 500) {
            GetAHT20();
            lastReadTime3 = currentTime;
        }
        return cachedTemperatureValue;
    }

    get_humidity(args) {
        const currentTime = Date.now();
        if (currentTime - lastReadTime2 > 500) {
            GetAHT20();
            lastReadTime2 = currentTime;
        }
        return cachedHumidityValue;
    }


    get_ultrasonic(args) {
        const currentTime = Date.now();
        if (currentTime - lastReadTime1 > 100) {
            GetUltrasonic();
            lastReadTime1 = Date.now();
        }
        return cachedUltrasonicValue;
    }

    Set_APDS9960_Mode(args) {
        try {

            if (Cast.toString(args.MODE) == "Proximity") {
                i2cBus.writeByteSync(DEVICE_ADDR, ENABLE_REG, 0x05); // Enable proximity mode
                APDSMode = 1;
      
            } else if (Cast.toString(args.MODE) == "Gesture") {
                i2cBus.writeByteSync(DEVICE_ADDR, ENABLE_REG, 0x41); // Enable gesture mode

                // Gesture configuration registers
                i2cBus.writeByteSync(DEVICE_ADDR, 0xA0, 0x01); // GPENTH
                i2cBus.writeByteSync(DEVICE_ADDR, 0xA1, 0x00); // GEXTH
                i2cBus.writeByteSync(DEVICE_ADDR, 0xA2, 0x01); // GCONF1
                i2cBus.writeByteSync(DEVICE_ADDR, 0xA3, 0x02); // GCONF2
                i2cBus.writeByteSync(DEVICE_ADDR, 0xA6, 0x89); // GPULSE
                i2cBus.writeByteSync(DEVICE_ADDR, GESTURE_MODE_REG, 0x00); // GMODE = 0
                i2cBus.writeByteSync(DEVICE_ADDR, GESTURE_MODE_REG, 0x01); // Enable continuous gesture mode

                APDSMode = 2;
            } else if (Cast.toString(args.MODE) == "Color") {
                i2cBus.writeByteSync(DEVICE_ADDR, ENABLE_REG, 0x02); // Enable color sensor
                APDSMode = 3;
           
            }
        } catch (error) {
            console.error("Error setting mode:", error);
        
        }
    }



    get_proximity() {
        if (APDSMode == 1) {
            try {
                return i2cBus.readByteSync(DEVICE_ADDR, PROXIMITY_REG);
            } catch (error) {
                console.error("Error reading proximity:", error);
                return null;
            }
        }
        return "Wrong Mode";
    }


    get_gesture() {
        try {
            let buffer = Buffer.alloc(4);
            i2cBus.readI2cBlockSync(DEVICE_ADDR, GESTURE_DATA_REG, 4, buffer);

            let [up, down, left, right] = buffer;
            let avg = (up + down + left + right) / 4;
            let offset = 5; // Sensitivity adjustment

            let highThreshold = avg + offset;
            let lowThreshold = avg - offset;

            if (Math.max(up, down, left, right) < highThreshold) {
                return "NO_GESTURE"; // Ignore weak signals
            }

            if (up > highThreshold && up > down && up > left && up > right) return "UP";
            if (down > highThreshold && down > up && down > left && down > right) return "DOWN";
            if (left > highThreshold && left > right && left > up && left > down) return "LEFT";
            if (right > highThreshold && right > left && right > up && right > down) return "RIGHT";

            return "NO_GESTURE";
        } catch (error) {
            console.error("Error reading gesture:", error);
            return null;
        }
    }
    get_color() {
        if (APDSMode == 3) {
            try {
                let buffer = Buffer.alloc(8);
                i2cBus.readI2cBlockSync(DEVICE_ADDR, 0x94, 8, buffer);

                let clear = buffer[0] | (buffer[1] << 8);
                let red = buffer[2] | (buffer[3] << 8);
                let green = buffer[4] | (buffer[5] << 8);
                let blue = buffer[6] | (buffer[7] << 8);

                let sum = red + green + blue; // Ignore 'clear' for better color ratio

                if (sum === 0) return [0, 0, 0]; // Prevent division by zero

                let redRatio = red / sum;
                let greenRatio = green / sum;
                let blueRatio = blue / sum;

                const color = [
                    Math.round(redRatio * 255),
                    Math.round(greenRatio * 255),
                    Math.round(blueRatio * 255)
                ];
                return color;
            } catch (error) {
                console.error("Error reading color:", error);
 
                return null;
            }
        }
        return "Wrong Mode";
    }


}

module.exports = Scratch3PiSTEMHATBlocks;
