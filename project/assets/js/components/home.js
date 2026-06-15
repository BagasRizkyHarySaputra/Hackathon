document.addEventListener("DOMContentLoaded", function() {
  const slider = document.querySelector('.ba-slider');
  const beforeImage = document.querySelector('.before-after__left');
  const dividerLine = document.querySelector('.before-after__line');

  if (slider && beforeImage && dividerLine) {
    slider.addEventListener('input', function(e) {
      const sliderPos = e.target.value;
      beforeImage.style.width = sliderPos + "%";
      dividerLine.style.left = sliderPos + "%";
    });
  }
});