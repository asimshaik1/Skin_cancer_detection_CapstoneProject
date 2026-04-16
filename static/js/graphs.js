document.addEventListener('DOMContentLoaded', () => {
    // ─── TAB SWITCHING LOGIC ───
    const datasetBtns = document.querySelectorAll('.tab-btn');
    const datasetAreas = document.querySelectorAll('.graphs-container');
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');

    // Dataset Tabs (BCN/HAM)
    datasetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.dataset;

            // Update Buttons
            datasetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update Areas
            datasetAreas.forEach(area => {
                area.classList.remove('active');
                if (area.id === `${target}-area`) {
                    area.classList.add('active');
                }
            });
        });
    });

    // Sub-Tabs (Binary/Multi)
    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const parentArea = btn.closest('.graphs-container');
            const subContents = parentArea.querySelectorAll('.sub-content');
            const siblingBtns = parentArea.querySelectorAll('.sub-tab-btn');

            // Update Buttons in this area only
            siblingBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update Content in this area only
            subContents.forEach(content => {
                content.classList.remove('active');
                if (content.id.includes(type)) {
                    content.classList.add('active');
                }
            });
        });
    });

    // ─── MODAL LOGIC ───
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const closeBtn = document.querySelector('.modal-close');

    // Select all visual items across all tabs
    const visualItems = document.querySelectorAll('.visual-item');

    visualItems.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            modal.classList.add('open');
            modalImg.src = img.src;
            document.body.style.overflow = 'hidden';
        });
    });

    const closeModal = () => {
        modal.classList.remove('open');
        document.body.style.overflow = 'auto';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
});
