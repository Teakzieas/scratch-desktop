var Oled = function(i2c, opts) {

  this.HEIGHT = opts.height || 32;
  this.WIDTH = opts.width || 128;
  this.ADDRESS = opts.address || 0x3C;
  this.PROTOCOL = 'I2C';
  this.LINESPACING = typeof opts.linespacing !== 'undefined' ? opts.linespacing : 1;
  this.LETTERSPACING = typeof opts.letterspacing !== 'undefined' ? opts.letterspacing : 1;

  // create command buffers
  this.DISPLAY_OFF = 0xAE;
  this.DISPLAY_ON = 0xAF;
  this.SET_DISPLAY_CLOCK_DIV = 0xD5;
  this.SET_MULTIPLEX = 0xA8;
  this.SET_DISPLAY_OFFSET = 0xD3;
  this.SET_START_LINE = 0x00;
  this.CHARGE_PUMP = 0x8D;
  this.EXTERNAL_VCC = false;
  this.MEMORY_MODE = 0x20;
  this.SEG_REMAP = 0xA1; // using 0xA0 will flip screen
  this.COM_SCAN_DEC = 0xC8;
  this.COM_SCAN_INC = 0xC0;
  this.SET_COM_PINS = 0xDA;
  this.SET_CONTRAST = 0x81;
  this.SET_PRECHARGE = 0xd9;
  this.SET_VCOM_DETECT = 0xDB;
  this.DISPLAY_ALL_ON_RESUME = 0xA4;
  this.NORMAL_DISPLAY = 0xA6;
  this.COLUMN_ADDR = 0x21;
  this.PAGE_ADDR = 0x22;
  this.INVERT_DISPLAY = 0xA7;
  this.ACTIVATE_SCROLL = 0x2F;
  this.DEACTIVATE_SCROLL = 0x2E;
  this.SET_VERTICAL_SCROLL_AREA = 0xA3;
  this.RIGHT_HORIZONTAL_SCROLL = 0x26;
  this.LEFT_HORIZONTAL_SCROLL = 0x27;
  this.VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL = 0x29;
  this.VERTICAL_AND_LEFT_HORIZONTAL_SCROLL = 0x2A;

  this.cursor_x = 0;
  this.cursor_y = 0;

  // new blank buffer
  //For version <6.0.0
  if(typeof Buffer.alloc == "undefined") {
    this.buffer = new Buffer((this.WIDTH * this.HEIGHT) / 8);
  }
  //For version >=6.0.0
  else {
    this.buffer = Buffer.alloc((this.WIDTH * this.HEIGHT) / 8);
  }
  this.buffer.fill(0x00);

  this.dirtyBytes = [];

  var config = {
    '128x32': {
      'multiplex': 0x1F,
      'compins': 0x02,
      'coloffset': 0
    },
    '128x64': {
      'multiplex': 0x3F,
      'compins': 0x12,
      'coloffset': 0
    },
    '96x16': {
      'multiplex': 0x0F,
      'compins': 0x2,
      'coloffset': 0,
    }
  };

  // Setup i2c
  //console.log('this.ADDRESS: ' + this.ADDRESS);
  this.wire = i2c;

  var screenSize = this.WIDTH + 'x' + this.HEIGHT;
  this.screenConfig = config[screenSize];

  this._initialise();
}

Oled.prototype._initialise = function() {

  // sequence of bytes to initialise with
  var initSeq = [
    this.DISPLAY_OFF,
    this.SET_DISPLAY_CLOCK_DIV, 0x80,
    this.SET_MULTIPLEX, this.screenConfig.multiplex, // set the last value dynamically based on screen size requirement
    this.SET_DISPLAY_OFFSET, 0x00, // sets offset pro to 0
    this.SET_START_LINE,
    this.CHARGE_PUMP, 0x14, // charge pump val
    this.MEMORY_MODE, 0x00, // 0x0 act like ks0108
    this.SEG_REMAP, // screen orientation
    this.COM_SCAN_DEC, // screen orientation change to INC to flip
    this.SET_COM_PINS, this.screenConfig.compins, // com pins val sets dynamically to match each screen size requirement
    this.SET_CONTRAST, 0x8F, // contrast val
    this.SET_PRECHARGE, 0xF1, // precharge val
    this.SET_VCOM_DETECT, 0x40, // vcom detect
    this.DISPLAY_ALL_ON_RESUME,
    this.NORMAL_DISPLAY,
    this.DISPLAY_ON
  ];

  var i, initSeqLen = initSeq.length;

  // write init seq commands
  for (i = 0; i < initSeqLen; i ++) {
    this._transfer('cmd', initSeq[i]);
  }
}

// writes both commands and data buffers to this device
Oled.prototype._transfer = function(type, val, fn) {
  var control;
  if (type === 'data') {
    control = 0x40;
  } else if (type === 'cmd') {
    control = 0x00;
  } else {
    return;
  }

  var bufferForSend, sentCount;
  //For version <6.0.0
  if(typeof Buffer.from == "undefined") {
    bufferForSend = new Buffer([control, val]);
  }
  //For version >=6.0.0
  else {
    bufferForSend = Buffer.from([control, val])
  }

  // send control and actual val
  sentCount = this.wire.i2cWriteSync(this.ADDRESS, 2, bufferForSend);
  if(fn) {
    fn();
  }
}

// read a byte from the oled
Oled.prototype._readI2C = function(fn) {
  //For version <6.0.0
  if(typeof Buffer.from == "undefined") {
    this.wire.i2cRead(this.ADDRESS, 0, new Buffer([0]), function(err, bytesRead, data) {
      // result is single byte
      if(typeof data === "object") {
        fn(data[0]);
      }
      else {
        fn(0);
      }
    });
  }
  //For version >=6.0.0
  else {
    var data=[0];
    this.wire.i2cReadSync(this.ADDRESS, 1, Buffer.from(data));
    fn(data[0]);
  }
}

// sometimes the oled gets a bit busy with lots of bytes.
// Read the response byte to see if this is the case
Oled.prototype._waitUntilReady = function(callback) {
  var done,
      oled = this;

  function tick(callback) {
    oled._readI2C(function(byte) {
      // read the busy byte in the response
      busy = byte >> 7 & 1;
      if (!busy) {
        // if not busy, it's ready for callback
        callback();
      } else {
        setTimeout(function () {tick(callback) }, 0);
      }
    });
  };

  setTimeout(function () {tick(callback) }, 0);
}

// set starting position of a text string on the oled
Oled.prototype.setCursor = function(x, y) {
  this.cursor_x = x;
  this.cursor_y = y;
}

// write text to the oled
Oled.prototype.writeString = function(font, size, string, color, wrap, sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;
  var wordArr = string.split(' '),
      len = wordArr.length,
      // start x offset at cursor pos
      offset = this.cursor_x,
      padding = 0;

  // loop through words
  for (var w = 0; w < len; w += 1) {
    // put the word space back in for all in between words or empty words
    if (w < len - 1 || !wordArr[w].length) {
      wordArr[w] += ' ';
    }
    var stringArr = wordArr[w].split(''),
        slen = stringArr.length,
        compare = (font.width * size * slen) + (size * (len -1));

    // wrap words if necessary
    if (wrap && len > 1 && w > 0 && (offset >= (this.WIDTH - compare)) ) {
      offset = 0;

      this.cursor_y += (font.height * size) + this.LINESPACING;
      this.setCursor(offset, this.cursor_y);
    }

    // loop through the array of each char to draw
    for (var i = 0; i < slen; i += 1) {
      if (stringArr[i] === '\n') {
        offset = 0;
        this.cursor_y += (font.height * size) + this.LINESPACING;
        this.setCursor(offset, this.cursor_y);
      }
      else {
        // look up the position of the char, pull out the buffer slice
        var charBuf = this._findCharBuf(font, stringArr[i]);
        // read the bits in the bytes that make up the char
        var charBytes = this._readCharBytes(charBuf, font.height);
        // draw the entire character
        this._drawChar(charBytes, font.height, size, false);

        // calc new x position for the next char, add a touch of padding too if it's a non space char
        //padding = (stringArr[i] === ' ') ? 0 : this.LETTERSPACING;
        offset += (font.width * size) + this.LETTERSPACING;// padding;

        // wrap letters if necessary
        if (wrap && (offset >= (this.WIDTH - font.width - this.LETTERSPACING))) {
          offset = 0;
          this.cursor_y += (font.height * size) + this.LINESPACING;
        }
        // set the 'cursor' for the next char to be drawn, then loop again for next char
        this.setCursor(offset, this.cursor_y);
      }
    }
  }
  if (immed) {
    this._updateDirtyBytes(this.dirtyBytes);
  }
}

// draw an individual character to the screen
Oled.prototype._drawChar = function(byteArray, charHeight, size, sync) {
  // take your positions...
  var x = this.cursor_x,
      y = this.cursor_y;

  // loop through the byte array containing the hexes for the char
  for (var i = 0; i < byteArray.length; i += 1) {
    for (var j = 0; j < charHeight; j += 1) {
      // pull color out
      var color = byteArray[i][j],
          xpos, ypos;
      // standard font size
      if (size === 1) {
        xpos = x + i;
        ypos = y + j;
        this.drawPixel([xpos, ypos, color], false);
      } else {
        // MATH! Calculating pixel size multiplier to primitively scale the font
        xpos = x + (i * size);
        ypos = y + (j * size);
        this.drawRect(xpos, ypos, size, size, color,1, false);
      }
    }
  }
}

// get character bytes from the supplied font object in order to send to framebuffer
Oled.prototype._readCharBytes = function(byteArray, charHeight) {
  var bitArr = [],
      bitCharArr = [];
  // loop through each byte supplied for a char
  for (var i = 0; i < byteArray.length; i += 1) {
    // set current byte
    var byte = byteArray[i];
    // read each byte
    for (var j = 0; j < charHeight; j += 1) {
      // shift bits right until all are read
      var bit = byte >> j & 1;
      bitArr.push(bit);
    }
    // push to array containing flattened bit sequence
    bitCharArr.push(bitArr);
    // clear bits for next byte
    bitArr = [];
  }
  return bitCharArr;
}

// find where the character exists within the font object
Oled.prototype._findCharBuf = function(font, c) {
  // use the lookup array as a ref to find where the current char bytes start
  var cBufPos = font.lookup.indexOf(c) * font.width;
  // slice just the current char's bytes out of the fontData array and return
  var cBuf = font.fontData.slice(cBufPos, cBufPos + font.width);
  return cBuf;
}

// send the entire framebuffer to the oled
Oled.prototype.update = function() {
  // wait for oled to be ready
  this._waitUntilReady(function() {
    // set the start and endbyte locations for oled display update
    var displaySeq = [
      this.COLUMN_ADDR,
      this.screenConfig.coloffset,
      this.screenConfig.coloffset + this.WIDTH - 1, // column start and end address
      this.PAGE_ADDR, 0, (this.HEIGHT / 8) - 1 // page start and end address
    ];

    var displaySeqLen = displaySeq.length,
        bufferLen = this.buffer.length,
        i, v;

    // send intro seq
    for (i = 0; i < displaySeqLen; i += 1) {
      this._transfer('cmd', displaySeq[i]);
    }

    // write buffer data
		var bufferToSend = Buffer.concat([Buffer.from([0x40]), this.buffer]);
		var sentCount = this.wire.i2cWriteSync(this.ADDRESS, bufferToSend.length, bufferToSend);

  }.bind(this));
}

// send dim display command to oled
Oled.prototype.dimDisplay = function(bool) {
  var contrast;

  if (bool) {
    contrast = 0; // Dimmed display
  } else {
    contrast = 0xCF; // Bright display
  }

  this._transfer('cmd', this.SET_CONTRAST);
  this._transfer('cmd', contrast);
}

// turn oled off
Oled.prototype.turnOffDisplay = function() {
  this._transfer('cmd', this.DISPLAY_OFF);
}

// turn oled on
Oled.prototype.turnOnDisplay = function() {
  this._transfer('cmd', this.DISPLAY_ON);
}

// clear all pixels currently on the display
Oled.prototype.clearDisplay = function(sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;
  // write off pixels
  this.buffer.fill(0x00);
	if (immed) {
		this.update();
	}

}

// invert pixels on oled
Oled.prototype.invertDisplay = function(bool) {
  if (bool) {
    this._transfer('cmd', this.INVERT_DISPLAY); // inverted
  } else {
    this._transfer('cmd', this.NORMAL_DISPLAY); // non inverted
  }
}

// draw an RGBA image at the specified coordinates
Oled.prototype.drawRGBAImage = function(image, dx, dy, sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;
  // translate image data to buffer
  var x, y, dataIndex, buffIndex, buffByte, bit, pixelByte;
  var dyp = this.WIDTH * Math.floor(dy / 8); // calc once
  var dxyp = dyp + dx;
  for (x = 0; x < image.width; x++) {
    var dxx = dx + x;
    if (dxx < 0 || dxx >= this.WIDTH) {
      // negative, off the screen
      continue;
    }
    // start buffer index for image column
    buffIndex = x + dxyp;
    buffByte = this.buffer[buffIndex];
    for (y = 0; y < image.height; y++) {
      var dyy = dy + y; // calc once
      if (dyy < 0 || dyy >= this.HEIGHT) {
        // negative, off the screen
        continue;
      }
      var dyyp = Math.floor(dyy / 8); // calc once

      // check if start of buffer page
      if (!(dyy % 8)) {
        // check if we need to save previous byte
        if ((x || y) && buffByte !== this.buffer[buffIndex]) {
          // save current byte and get next buffer byte
          this.buffer[buffIndex] = buffByte;
          this.dirtyBytes.push(buffIndex);
        }
        // new buffer page
        buffIndex = dx + x + this.WIDTH * dyyp;
        buffByte = this.buffer[buffIndex];
      }

      // process pixel into buffer byte
      dataIndex = (image.width * y + x) << 2; // 4 bytes per pixel (RGBA)
      if (!image.data[dataIndex + 3]) {
        // transparent, continue to next pixel
        continue;
      }

      pixelByte = 0x01 << (dyy - 8 * dyyp);
      bit = image.data[dataIndex] || image.data[dataIndex + 1] || image.data[dataIndex + 2];
      if (bit) {
        buffByte |= pixelByte;
      }
      else {
        buffByte &= ~pixelByte;
      }
    }
    if ((x || y) && buffByte !== this.buffer[buffIndex]) {
      // save current byte
      this.buffer[buffIndex] = buffByte;
      this.dirtyBytes.push(buffIndex);
    }
  }

  if (immed) {
    this._updateDirtyBytes(this.dirtyBytes);
  }
}

// draw an image pixel array on the screen
Oled.prototype.drawBitmap = function(pixels, sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;
  var x, y,
      pixelArray = [];

  for (var i = 0; i < pixels.length; i++) {
    x = Math.floor(i % this.WIDTH);
    y = Math.floor(i / this.WIDTH);

    this.drawPixel([x, y, pixels[i]], false);
  }

  if (immed) {
    this._updateDirtyBytes(this.dirtyBytes);
  }
}

// draw one or many pixels on oled
Oled.prototype.drawPixel = function(pixels, sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;

  // handle lazy single pixel case
  if (typeof pixels[0] !== 'object') pixels = [pixels];

  pixels.forEach(function(el) {
    // return if the pixel is out of range
    var x = el[0], y = el[1], color = el[2];
    if (x >= this.WIDTH || y >= this.HEIGHT) return;

    // thanks, Martin Richards.
    // I wanna can this, this tool is for devs who get 0 indexes
    //x -= 1; y -=1;
    var byte = 0,
        page = Math.floor(y / 8),
        pageShift = 0x01 << (y - 8 * page);

    // is the pixel on the first row of the page?
    (page == 0) ? byte = x : byte = x + (this.WIDTH * page);

    // colors! Well, monochrome.
    if (color === 'BLACK' || color === 0) {
      this.buffer[byte] &= ~pageShift;
    }
    if (color === 'WHITE' || color > 0) {
      this.buffer[byte] |= pageShift;
    }

    // push byte to dirty if not already there
    if (this.dirtyBytes.indexOf(byte) === -1) {
      this.dirtyBytes.push(byte);
    }

  }, this);

  if (immed) {
    this._updateDirtyBytes(this.dirtyBytes);
  }
}

// looks at dirty bytes, and sends the updated bytes to the display
Oled.prototype._updateDirtyBytes = function(byteArray) {
  var blen = byteArray.length, i,
      displaySeq = [];

  // check to see if this will even save time
  if (blen > (this.buffer.length / 7)) {
    // just call regular update at this stage, saves on bytes sent
    this.update();
    // now that all bytes are synced, reset dirty state
    this.dirtyBytes = [];

  } else {

    this._waitUntilReady(function() {
      // iterate through dirty bytes
      for (var i = 0; i < blen; i += 1) {

        var byte = byteArray[i];
        var page = Math.floor(byte / this.WIDTH);
        var col = Math.floor(byte % this.WIDTH);

        var displaySeq = [
          this.COLUMN_ADDR, col, col, // column start and end address
          this.PAGE_ADDR, page, page // page start and end address
        ];

        var displaySeqLen = displaySeq.length, v;

        // send intro seq
        for (v = 0; v < displaySeqLen; v += 1) {
          this._transfer('cmd', displaySeq[v]);
        }
        // send byte, then move on to next byte
        this._transfer('data', this.buffer[byte]);
        this.buffer[byte];
      }
    }.bind(this));
  }
  // now that all bytes are synced, reset dirty state
  this.dirtyBytes = [];
}

// using Bresenham's line algorithm
Oled.prototype.drawLine = function(x0, y0, x1, y1, color, sync) {
  var immed = (typeof sync === 'undefined') ? true : sync;

  var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1,
      dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1,
      err = (dx > dy ? dx : -dy) / 2;

  while (true) {
    this.drawPixel([x0, y0, color], false);

    if (x0 === x1 && y0 === y1) break;

    var e2 = err;

    if (e2 > -dx) {err -= dy; x0 += sx;}
    if (e2 < dy) {err += dx; y0 += sy;}
  }

  if (immed) {
    this._updateDirtyBytes(this.dirtyBytes);
  }
}

Oled.prototype.drawCircle = function(cx, cy, radius, color, solid, sync) {
    var immed = (typeof sync === 'undefined') ? true : sync;

    let x = radius;
    let y = 0;
    let p = 1 - radius;

    // Helper function to plot all symmetrical points of the circle
    const plotCirclePoints = (cx, cy, x, y, color) => {
        this.drawPixel([
            [cx + x, cy + y, color],
            [cx - x, cy + y, color],
            [cx + x, cy - y, color],
            [cx - x, cy - y, color],
            [cx + y, cy + x, color],
            [cx - y, cy + x, color],
            [cx + y, cy - x, color],
            [cx - y, cy - x, color],
        ], false);
    };

    // Helper function to draw a solid circle
    const drawSolidCircle = (cx, cy, x, y, color) => {
        for (let i = -x; i <= x; i++) {
            this.drawPixel([[cx + i, cy + y, color], [cx + i, cy - y, color]], false);
        }
        for (let i = -y; i <= y; i++) {
            this.drawPixel([[cx + i, cy + x, color], [cx + i, cy - x, color]], false);
        }
    };

    // Plot the initial points
    if (solid) {
        drawSolidCircle(cx, cy, x, y, color);
    } else {
        plotCirclePoints(cx, cy, x, y, color);
    }

    // Midpoint algorithm loop
    while (x > y) {
        y++;

        // Update the decision parameter
        if (p <= 0) {
            p = p + 2 * y + 1;
        } else {
            x--;
            p = p + 2 * y - 2 * x + 1;
        }

        // Plot the points for the current x and y
        if (solid) {
            drawSolidCircle(cx, cy, x, y, color);
        } else {
            plotCirclePoints(cx, cy, x, y, color);
        }
    }

    if (immed) {
        this._updateDirtyBytes(this.dirtyBytes);
    }
};

// Draw a rectangle (solid or outline) on the OLED
Oled.prototype.drawRect = function(x, y, w, h, color, solid, sync) {
    var immed = (typeof sync === 'undefined') ? true : sync;

    if (solid) {
        // Draw a filled rectangle (solid)
        for (var i = x; i < x + w; i += 1) {
            this.drawLine(i, y, i, y + h - 1, color, false);
        }
    } else {
        // Draw an outline rectangle
        // Top and bottom horizontal lines
        this.drawLine(x, y, x + w - 1, y, color, false);
        this.drawLine(x, y + h - 1, x + w - 1, y + h - 1, color, false);

        // Left and right vertical lines
        this.drawLine(x, y, x, y + h - 1, color, false);
        this.drawLine(x + w - 1, y, x + w - 1, y + h - 1, color, false);
    }

    if (immed) {
        this._updateDirtyBytes(this.dirtyBytes);
    }
};

// activate scrolling for rows start through stop
Oled.prototype.startScroll = function(dir, start, stop) {
  var scrollHeader,
      cmdSeq = [];

  switch (dir) {
    case 'right':
      cmdSeq.push(this.RIGHT_HORIZONTAL_SCROLL); break;
    case 'left':
      cmdSeq.push(this.LEFT_HORIZONTAL_SCROLL); break;
    // TODO: left diag and right diag not working yet
    case 'left diagonal':
      cmdSeq.push(
        this.SET_VERTICAL_SCROLL_AREA, 0x00,
        this.VERTICAL_AND_LEFT_HORIZONTAL_SCROLL,
        this.HEIGHT
      );
      break;
    // TODO: left diag and right diag not working yet
    case 'right diagonal':
      cmdSeq.push(
        this.SET_VERTICAL_SCROLL_AREA, 0x00,
        this.VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL,
        this.HEIGHT
      );
      break;
  }

  this._waitUntilReady(function() {
    cmdSeq.push(
      0x00, start,
      0x00, stop,
      // TODO: these need to change when diagonal
      0x00, 0xFF,
      this.ACTIVATE_SCROLL
    );

    var i, cmdSeqLen = cmdSeq.length;

    for (i = 0; i < cmdSeqLen; i += 1) {
      this._transfer('cmd', cmdSeq[i]);
    }
  }.bind(this));
}

// stop scrolling display contents
Oled.prototype.stopScroll = function() {
  this._transfer('cmd', this.DEACTIVATE_SCROLL); // stahp
}




Oled.prototype.scaleImageToFitAspectRatio = function(image, targetWidth, targetHeight) {
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Calculate the scaling factor for width and height
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;

  // Choose the smaller scale factor to maintain aspect ratio
  const scale = Math.min(scaleX, scaleY);

  // Calculate the new width and height based on the scale factor
  const newWidth = Math.floor(originalWidth * scale);
  const newHeight = Math.floor(originalHeight * scale);

  // Create a new array for the scaled image data
  let scaledBitmap = [];

  // Loop through each pixel of the target (scaled) image
  for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
          // Find the corresponding position in the original image
          const origX = Math.floor(x / scale);
          const origY = Math.floor(y / scale);

          // Calculate the index in the original image data
          const index = (origY * originalWidth + origX) * 4;

          // Get the RGBA values from the original image
          const r = image.data[index];
          const g = image.data[index + 1];
          const b = image.data[index + 2];
          const a = image.data[index + 3];

          // Add the RGBA values to the scaled bitmap
          scaledBitmap.push(r, g, b, a);
      }
  }

  return {
      width: newWidth,
      height: newHeight,
      data: scaledBitmap
  };
}

Oled.prototype.scaleImageToFit = function(image, targetWidth, targetHeight) {
  const originalWidth = image.width;
  const originalHeight = image.height;
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;

  // Create a new array for the scaled image data
  let scaledBitmap = [];

  // Loop through each pixel of the target (scaled) image
  for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
          // Find the corresponding position in the original image
          const origX = Math.floor(x / scaleX);
          const origY = Math.floor(y / scaleY);

          // Calculate the index in the original image data
          const index = (origY * originalWidth + origX) * 4;
          
          // Get the RGBA values from the original image
          const r = image.data[index];
          const g = image.data[index + 1];
          const b = image.data[index + 2];
          const a = image.data[index + 3];

          // Add the RGBA values to the scaled bitmap
          scaledBitmap.push(r, g, b, a);
      }
  }

  return {
      width: targetWidth,
      height: targetHeight,
      data: scaledBitmap
  };
}

Oled.prototype.DrawSpriteBitmap = function(runtime,spriteName,x,y,scale) {
  // Ensure the runtime and renderer are available
  if (!runtime || !runtime.renderer) {
      return;
  }

  // Get the currently editing target (the selected sprite)
  const currentTarget = runtime.targets.find(target => target.getName() === spriteName);
  if (!currentTarget) {
      return;
  }
  

  // Get the drawable ID of the current target
  const drawableID = currentTarget.drawableID;
  if (drawableID === undefined) {
      return;
  }

  // Access the drawable object
  const drawable = runtime.renderer._allDrawables[drawableID];
  if (!drawable) {
      return;
  }

  // Access the skin associated with the drawable
  const skin = drawable.skin;
  if (!skin) {
      return;
  }
  else
  {
      
      const silhouette = skin._silhouette;
      const height = silhouette._height;
      const width = silhouette._width;
      const colorData = silhouette._colorData;
  
      if (!colorData) {
          return;
      }
  
      // Create an array to hold the final bitmap data (each pixel is 4 values: R, G, B, A)
      let bitmap = [];
  
      // Iterate over the colorData and assign RGBA values to bitmap
      for (let i = 0; i < colorData.length; i += 4) {
          // Assuming color data comes in a sequential order of R, G, B, A
          const r = colorData[i];
          const g = colorData[i + 1];
          const b = colorData[i + 2];
          const a = colorData[i + 3];
  
          // Add the pixel data (RGBA) to the bitmap array
          bitmap.push(r, g, b, a);
      }
  
      
      if(scale == 1){
          const image = {
              width: width,
              height: height,
              data: bitmap
            };

          var scaledImage = this.scaleImageToFit(image, 128, 64);
            
          this.drawRGBAImage(scaledImage,x,y);

      } 
      else if(scale == 2){
          const image = {
              width: width,
              height: height,
              data: bitmap
            };

          var scaledImage = this.scaleImageToFitAspectRatio(image, 128, 64);
            
          this.drawRGBAImage(scaledImage,x,y);

      } 
      else{
          const image = {
              width: width,
              height: height,
              data: bitmap
            };
            
            this.drawRGBAImage(image,x,y);

      }

      
     
  }
}

module.exports = Oled;
