document.querySelectorAll('[data-character-count]').forEach((counter) => {
	const field = document.getElementById(counter.dataset.characterCount);

	if (!field) {
		return;
	}

	const updateCount = () => {
		counter.textContent = `${field.value.length} / ${field.maxLength}`;
	};

	field.addEventListener('input', updateCount);
	updateCount();
});

const itemGrid = document.querySelector('.item-grid');

if (itemGrid) {
	const resizeObserver = new ResizeObserver((entries) => {
		const gridStyles = getComputedStyle(itemGrid);
		const rowHeight = parseFloat(gridStyles.gridAutoRows) || 1;
		const rowGap = parseFloat(gridStyles.rowGap) || 0;

		entries.forEach(({ target: card }) => {
			const cardHeight = card.getBoundingClientRect().height;
			const bottomMargin = parseFloat(getComputedStyle(card).marginBottom) || 0;
			const rowSpan = Math.ceil((cardHeight + bottomMargin + rowGap) / (rowHeight + rowGap));

			card.style.gridRowEnd = `span ${rowSpan}`;
		});
	});

	itemGrid.querySelectorAll('.item-card').forEach((card) => resizeObserver.observe(card));
}
