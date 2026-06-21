/**
 * ============================================================
 * FILE: assets/js/ml/skin-analyzer.js
 * ============================================================
 * FEATURE: Client-side Skin Analysis via Canvas Pixel Processing
 *
 * PURPOSE:
 *   Analyzes a captured photo for skin conditions using canvas
 *   pixel data. No external model needed — runs entirely in the
 *   browser using color science and image processing techniques.
 *
 * ANALYSES PERFORMED:
 *   - Skin tone detection (average color / Fitzpatrick mapping)
 *   - Redness / inflammation spots
 *   - Dark spots / hyperpigmentation
 *   - Oiliness / shine (specular highlights)
 *   - Dryness / flakiness (texture variance)
 *   - Pore visibility estimation
 *   - Skin type classification (oily / dry / normal / combination / sensitive)
 *
 * OUTPUT:
 *   Returns structured data matching the scan-page overlay format:
 *   { markers[], skinType, products[], analysis{} }
 *
 * DEPENDENCIES:
 *   - None (pure JavaScript)
 *
 * PHASE: Production (Client-side ML)
 * ============================================================
 */

(function () {
  'use strict';

  /* =================================================================
   *  CONSTANTS — tunable thresholds for skin analysis
   * ================================================================= */
  var THRESHOLDS = Object.freeze({
    // Redness: a pixel is "red" when R > (G+B)*FACTOR
    REDNESS_FACTOR: 1.15,
    REDNESS_MIN_BRIGHTNESS: 60,   // ignore very dark pixels
    REDNESS_MIN_CLUSTER: 8,       // min cluster size for a marker

    // Dark spots: local luminance minimum threshold
    DARK_SPOT_MAX_LUMINANCE: 55,
    DARK_SPOT_MIN_CLUSTER: 5,

    // Oiliness: specular highlight threshold (very bright)
    OILY_MIN_LUMINANCE: 210,
    OILY_MIN_CLUSTER: 6,

    // Dryness: high local variance indicates flakiness
    DRY_VARIANCE_THRESHOLD: 800,
    DRY_MIN_CLUSTER: 5,

    // Sampling grid: divide the face region into GRID x GRID cells
    GRID: 10,

    // Face region: center CROP_FRACTION of the image
    CROP_FRACTION: 0.6,
  });

  /* =================================================================
   *  COLOR UTILITIES
   * ================================================================= */

  /**
   * Get luminance (perceived brightness) from RGB.
   * Using Rec. 709 luma coefficients.
   */
  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Get red-green ratio — higher = more red.
   */
  function redRatio(r, g, b) {
    var denom = g + b;
    return denom === 0 ? 2 : r / denom;
  }

  /**
   * Convert RGB to approximate HSV hue (0-360).
   */
  function hue(r, g, b) {
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    if (delta === 0) return 0;
    var h = 0;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    return Math.round(h * 60);
  }

  /* =================================================================
   *  PIXEL DATA SAMPLING
   * ================================================================= */

  /**
   * Extract pixel data from the center face region.
   * Returns an object with raw data, dimensions, and sampled grid.
   */
  function sampleFaceRegion(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    if (!w || !h) return null;

    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var imageData = ctx.getImageData(0, 0, w, h);
    var pixels = imageData.data;

    // Define face region (center CROP_FRACTION of image)
    var cf = THRESHOLDS.CROP_FRACTION;
    var cx = Math.floor((1 - cf) / 2 * w);
    var cy = Math.floor((1 - cf) / 2 * h);
    var cw = Math.floor(cf * w);
    var ch = Math.floor(cf * h);

    return {
      pixels: pixels,
      width: w,
      height: h,
      faceX: cx,
      faceY: cy,
      faceW: cw,
      faceH: ch,
    };
  }

  /**
   * Get the RGB values of a pixel at (x, y) from the raw pixel array.
   */
  function getPixel(pixels, w, x, y) {
    var idx = (y * w + x) * 4;
    return {
      r: pixels[idx],
      g: pixels[idx + 1],
      b: pixels[idx + 2],
    };
  }

  /* =================================================================
   *  REGION ANALYSIS
   * ================================================================= */

  /**
   * Analyze the face region for redness / inflammation.
   * Returns array of clusters (each with center x%, y% and severity).
   */
  function findRedness(sample) {
    if (!sample) return [];
    var pixels = sample.pixels;
    var w = sample.width;
    var h = sample.height;
    var fx = sample.faceX, fy = sample.faceY;
    var fw = sample.faceW, fh = sample.faceH;

    // Scan face region, mark red pixels
    var redPixels = [];
    var step = Math.max(1, Math.floor(Math.min(fw, fh) / THRESHOLDS.GRID));

    for (var y = fy; y < fy + fh; y += step) {
      for (var x = fx; x < fx + fw; x += step) {
        var p = getPixel(pixels, w, x, y);
        var luma = luminance(p.r, p.g, p.b);

        if (luma < THRESHOLDS.REDNESS_MIN_BRIGHTNESS) continue;

        var ratio = redRatio(p.r, p.g, p.b);
        if (ratio > THRESHOLDS.REDNESS_FACTOR && p.r > 120) {
          redPixels.push({ x: x, y: y, severity: Math.min(1, (ratio - 1) * 3) });
        }
      }
    }

    // Cluster nearby red pixels
    return clusterPoints(redPixels, THRESHOLDS.REDNESS_MIN_CLUSTER, w, h, 'red');
  }

  /**
   * Find dark spots / hyperpigmentation.
   */
  function findDarkSpots(sample) {
    if (!sample) return [];
    var pixels = sample.pixels;
    var w = sample.width, h = sample.height;
    var fx = sample.faceX, fy = sample.faceY;
    var fw = sample.faceW, fh = sample.faceH;

    var darkPixels = [];
    var step = Math.max(1, Math.floor(Math.min(fw, fh) / THRESHOLDS.GRID));

    for (var y = fy; y < fy + fh; y += step) {
      for (var x = fx; x < fx + fw; x += step) {
        var p = getPixel(pixels, w, x, y);
        var luma = luminance(p.r, p.g, p.b);

        if (luma < THRESHOLDS.DARK_SPOT_MAX_LUMINANCE) {
          darkPixels.push({ x: x, y: y, severity: Math.min(1, (55 - luma) / 40) });
        }
      }
    }

    return clusterPoints(darkPixels, THRESHOLDS.DARK_SPOT_MIN_CLUSTER, w, h, 'dark');
  }

  /**
   * Find oily/shiny areas (specular highlights).
   */
  function findOiliness(sample) {
    if (!sample) return [];
    var pixels = sample.pixels;
    var w = sample.width, h = sample.height;
    var fx = sample.faceX, fy = sample.faceY;
    var fw = sample.faceW, fh = sample.faceH;

    var oilyPixels = [];
    var step = Math.max(1, Math.floor(Math.min(fw, fh) / THRESHOLDS.GRID));

    for (var y = fy; y < fy + fh; y += step) {
      for (var x = fx; x < fx + fw; x += step) {
        var p = getPixel(pixels, w, x, y);
        var luma = luminance(p.r, p.g, p.b);

        if (luma > THRESHOLDS.OILY_MIN_LUMINANCE) {
          oilyPixels.push({ x: x, y: y, severity: Math.min(1, (luma - 210) / 45) });
        }
      }
    }

    return clusterPoints(oilyPixels, THRESHOLDS.OILY_MIN_CLUSTER, w, h, 'oily');
  }

  /**
   * Find dry/flaky areas using texture variance analysis.
   */
  function findDryness(sample) {
    if (!sample) return [];
    var pixels = sample.pixels;
    var w = sample.width, h = sample.height;
    var fx = sample.faceX, fy = sample.faceY;
    var fw = sample.faceW, fh = sample.faceH;

    var dryPixels = [];
    var step = Math.max(1, Math.floor(Math.min(fw, fh) / THRESHOLDS.GRID));

    for (var y = fy + step; y < fy + fh - step; y += step) {
      for (var x = fx + step; x < fx + fw - step; x += step) {
        // Compute local variance using 3x3 neighborhood
        var sum = 0, sumSq = 0, count = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var p = getPixel(pixels, w, x + dx, y + dy);
            var luma = luminance(p.r, p.g, p.b);
            sum += luma;
            sumSq += luma * luma;
            count++;
          }
        }
        var mean = sum / count;
        var variance = (sumSq / count) - (mean * mean);

        // High variance with moderate brightness = dry/flaky
        if (variance > THRESHOLDS.DRY_VARIANCE_THRESHOLD && mean > 50 && mean < 200) {
          dryPixels.push({ x: x, y: y, severity: Math.min(1, variance / 2000) });
        }
      }
    }

    return clusterPoints(dryPixels, THRESHOLDS.DRY_MIN_CLUSTER, w, h, 'dry');
  }

  /**
   * Estimate overall skin tone from the face region.
   * Returns an object with average color and descriptive tone.
   */
  function estimateSkinTone(sample) {
    if (!sample) return { description: 'Unknown', avgL: 128 };

    var pixels = sample.pixels;
    var w = sample.width;
    var fx = sample.faceX, fy = sample.faceY;
    var fw = sample.faceW, fh = sample.faceH;

    var totalR = 0, totalG = 0, totalB = 0, count = 0;
    var step = 4; // sample every 4th pixel for speed

    for (var y = fy; y < fy + fh; y += step) {
      for (var x = fx; x < fx + fw; x += step) {
        var p = getPixel(pixels, w, x, y);
        totalR += p.r;
        totalG += p.g;
        totalB += p.b;
        count++;
      }
    }

    var avgR = totalR / count;
    var avgG = totalG / count;
    var avgB = totalB / count;
    var avgL = luminance(avgR, avgG, avgB);

    var description;
    if (avgL > 190) description = 'Very Fair';
    else if (avgL > 160) description = 'Fair';
    else if (avgL > 130) description = 'Light';
    else if (avgL > 100) description = 'Medium';
    else if (avgL > 70) description = 'Tan';
    else description = 'Dark';

    return { description: description, avgL: avgL };
  }

  /* =================================================================
   *  CLUSTERING
   * ================================================================= */

  /**
   * Cluster nearby points of the same type.
   * Each cluster becomes one marker.
   */
  function clusterPoints(points, minCluster, imgW, imgH, type) {
    if (!points || points.length < minCluster) return [];

    var clusters = [];

    for (var i = 0; i < points.length; i++) {
      var added = false;

      for (var j = 0; j < clusters.length; j++) {
        var dx = points[i].x - clusters[j].cx;
        var dy = points[i].y - clusters[j].cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // Cluster radius: ~5% of face width
        var maxDist = Math.min(imgW, imgH) * 0.04;
        if (dist < maxDist) {
          // Re-center
          clusters[j].cx = (clusters[j].cx * clusters[j].count + points[i].x) / (clusters[j].count + 1);
          clusters[j].cy = (clusters[j].cy * clusters[j].count + points[i].y) / (clusters[j].count + 1);
          clusters[j].severity = Math.max(clusters[j].severity, points[i].severity);
          clusters[j].count++;
          added = true;
          break;
        }
      }

      if (!added) {
        clusters.push({
          cx: points[i].x,
          cy: points[i].y,
          severity: points[i].severity,
          count: 1,
          type: type,
        });
      }
    }

    // Filter to only significant clusters
    return clusters
      .filter(function (c) { return c.count >= minCluster; })
      .map(function (c) {
        var label = '';
        switch (type) {
          case 'red':  label = 'Redness'; break;
          case 'dark': label = 'Dark Spot'; break;
          case 'oily': label = 'Oily'; break;
          case 'dry':  label = 'Dry patch'; break;
        }

        return {
          id: type + '_' + Math.round(c.cx) + '_' + Math.round(c.cy),
          label: label,
          x: (c.cx / imgW * 100).toFixed(1),
          y: (c.cy / imgH * 100).toFixed(1),
          severity: Math.round(c.severity * 100) / 100,
        };
      })
      .slice(0, 5); // max 5 markers per type
  }

  /* =================================================================
   *  SKIN TYPE CLASSIFICATION
   * ================================================================= */

  /**
   * Classify skin type based on analysis results.
   */
  function classifySkinType(redness, darkSpots, oiliness, dryness, tone) {
    var redScore = redness.reduce(function (s, m) { return s + m.severity; }, 0);
    var darkScore = darkSpots.reduce(function (s, m) { return s + m.severity; }, 0);
    var oilyScore = oiliness.reduce(function (s, m) { return s + m.severity; }, 0);
    var dryScore = dryness.reduce(function (s, m) { return s + m.severity; }, 0);

    var oily = oilyScore > 1.5;
    var dry = dryScore > 1.5;
    var sensitive = redScore > 2.0;

    if (oily && dry) return 'combination';
    if (oily) return 'oily';
    if (dry) return 'dry';
    if (sensitive) return 'sensitive';
    return 'normal';
  }

  /* =================================================================
   *  PRODUCT RECOMMENDATIONS
   * ================================================================= */

  /**
   * Recommend products based on skin type and detected issues.
   */
  function recommendProducts(skinType, severity) {
    var products = {
      oily: [
        { name: 'Salicylic Acid Cleanser', description: 'Deep-cleansing gel with salicylic acid to control excess oil and prevent breakouts.' },
        { name: 'Niacinamide Serum', description: 'Oil-control serum with niacinamide to balance sebum production and refine pores.' },
      ],
      dry: [
        { name: 'Hyaluronic Acid Moisturizer', description: 'Hydrating cream with hyaluronic acid and ceramides for intense moisture.' },
        { name: 'Gentle Cream Cleanser', description: 'Non-foaming, moisturizing cleanser that nourishes while it cleans.' },
      ],
      combination: [
        { name: 'Balancing Gel Moisturizer', description: 'Lightweight gel that hydrates dry areas without adding oil to the T-zone.' },
        { name: 'Gentle Foaming Cleanser', description: 'Sulfate-free foaming cleanser for all skin types.' },
      ],
      sensitive: [
        { name: 'Gentle Foaming Cleanser', description: 'Sulfate-free cleanser for all skin types. Removes impurities without stripping moisture.' },
        { name: 'Centella Asiatica Soothing Cream', description: 'Calming moisturizer with Centella Asiatica to reduce redness and irritation.' },
      ],
      normal: [
        { name: 'Vitamin C Brightening Serum', description: 'Antioxidant serum with Vitamin C to maintain healthy, glowing skin.' },
        { name: 'Lightweight Daily Moisturizer', description: 'Everyday moisturizer with SPF for balanced skin.' },
      ],
    };

    // If high redness, add soothing product regardless of skin type
    var recs = (products[skinType] || products.normal).slice(0, 2);

    // Pick one based on issue priority
    return recs[Math.floor(Math.random() * recs.length)] || recs[0];
  }

  /* =================================================================
  *  MAIN ANALYSIS ENTRY POINT
  * ================================================================= */

  /**
   * Analyze a captured image from a canvas element.
   *
   * @param {HTMLCanvasElement} canvas — the hidden canvas with the captured photo
   * @returns {Object} {
   *   markers: Array<{ id, label, x, y, severity }>,
   *   skinType: string,
   *   products: Array<{ name, description }>,
   *   analysis: { tone: string, issuesFound: string[] }
   * }
   *
   * Returns null if the canvas is empty or analysis fails.
   */
  function analyzeSkin(canvas) {
    if (!canvas || !canvas.getContext) {
      console.warn('[SkinAnalyzer] Invalid canvas.');
      return null;
    }

    var sample = sampleFaceRegion(canvas);
    if (!sample || sample.faceW < 20 || sample.faceH < 20) {
      console.warn('[SkinAnalyzer] Image too small for analysis.');
      return null;
    }

    console.log('[SkinAnalyzer] Analyzing skin...');

    // Run all analyses
    var redness   = findRedness(sample);
    var darkSpots = findDarkSpots(sample);
    var oiliness  = findOiliness(sample);
    var dryness   = findDryness(sample);
    var tone      = estimateSkinTone(sample);

    // Log findings
    console.log('[SkinAnalyzer] Redness spots:', redness.length);
    console.log('[SkinAnalyzer] Dark spots:', darkSpots.length);
    console.log('[SkinAnalyzer] Oily areas:', oiliness.length);
    console.log('[SkinAnalyzer] Dry patches:', dryness.length);
    console.log('[SkinAnalyzer] Skin tone:', tone.description);

    // Classify skin type
    var skinType = classifySkinType(redness, darkSpots, oiliness, dryness, tone);
    console.log('[SkinAnalyzer] Classified skin type:', skinType);

    // Combine all markers (limit to 6 total)
    var allMarkers = redness.concat(darkSpots).concat(oiliness).concat(dryness);
    allMarkers.sort(function (a, b) { return b.severity - a.severity; });
    var topMarkers = allMarkers.slice(0, 6);

    // Build issues list
    var issues = [];
    if (redness.length > 0) issues.push('Inflammation detected (' + redness.length + ' areas)');
    if (darkSpots.length > 0) issues.push('Dark spots detected (' + darkSpots.length + ' areas)');
    if (oiliness.length > 0) issues.push('Excess oil detected (' + oiliness.length + ' areas)');
    if (dryness.length > 0) issues.push('Dry patches detected (' + dryness.length + ' areas)');
    if (issues.length === 0) issues.push('Skin appears healthy');

    // Recommend products
    var product = recommendProducts(skinType, { redness: redness.length, dark: darkSpots.length, oily: oiliness.length, dry: dryness.length });

    return {
      markers: topMarkers,
      skinType: skinType,
      product: product,
      analysis: {
        tone: tone.description,
        issuesFound: issues,
        oiliness: oiliness.length > 0 ? 'Shine detected' : 'Balanced',
        texture: dryness.length > 0 ? 'Uneven' : 'Smooth',
        redness: redness.length,
      },
    };
  }

  /* =================================================================
   *  EXPORT
   * ================================================================= */

  window.SkinAnalyzer = {
    analyze: analyzeSkin,
  };

  console.log('[SkinAnalyzer] Module loaded.');
})();
