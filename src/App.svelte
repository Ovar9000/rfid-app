<script lang="ts">
  import { onMount } from 'svelte';
  import RegistrationModal from './RegistrationModal.svelte';

  let rfidInput = '';
  let lastKeyTime = 0;
  let showModal = false;
  let detectedRfid = '';

  // This function handles the keyboard events to capture the RFID string.
  const handleKeydown = (event: KeyboardEvent) => {
    const currentTime = Date.now();
    
    // If keys are pressed too far apart, it's likely manual typing.
    // We reset the input. 50ms is a good starting point for scanners.
    if (currentTime - lastKeyTime > 50) {
      rfidInput = '';
    }

    // If the 'Enter' key is pressed, we assume it's the end of the RFID scan.
    if (event.key === 'Enter') {
      if (rfidInput.length > 5) { // Basic validation: check if we have a reasonable string length
        console.log('RFID Detected:', rfidInput);
        detectedRfid = rfidInput;
        showModal = true;
      }
      rfidInput = ''; // Reset for the next scan
    } else {
      // Add the pressed key to our input string.
      rfidInput += event.key;
    }

    // Update the time of the last key press.
    lastKeyTime = currentTime;
  };

  // This function handles the registration data submitted from the modal.
  const handleRegister = (event: CustomEvent<any>) => {
    const studentData = event.detail;
    console.log('Registering Student:', studentData);
    // Here you would typically send the data to your backend/API
    // For example: await fetch('/api/register', { method: 'POST', body: JSON.stringify(studentData) });
    alert(`Registered:\nRFID: ${studentData.rfid}\nID: ${studentData.idNumber}\nName: ${studentData.studentName}`);
    showModal = false; // Close the modal after registration
  };

  // This function handles the close event from the modal.
  const handleCloseModal = () => {
    showModal = false;
    rfidInput = ''; // Clear input in case a scan was partial
  };

  onMount(() => {
    // Add the event listener to the whole window when the component mounts.
    window.addEventListener('keydown', handleKeydown);

    // Clean up the event listener when the component is destroyed.
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<main class="full-window flex flex-col items-center justify-center bg-gray-100">
  <div class=" text-center">
    <h1 class="text-4xl font-bold text-gray-800 mb-2">RFID Registration System</h1>
    <p class="text-lg text-gray-600">Please scan an RFID card to begin registration.</p>
    <div class="mt-8">
      <svg class="w-24 h-24 text-blue-500 mx-auto animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <p class="mt-4 text-gray-500 font-semibold">Waiting for scan...</p>
    </div>
  </div>

  {#if showModal}
    <RegistrationModal 
      rfid={detectedRfid} 
      on:register={handleRegister}
      on:close={handleCloseModal}
    />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    height: 100%; /* Important for body to respect viewport height */
    width: 100%;  /* Important for body to respect viewport width */
    overflow: hidden; /* Prevent scrollbars if not needed, or use auto */
}
  /* You can add global styles here or in a separate CSS file */
  /* This example uses utility-first classes that you might get from Tailwind CSS, */
  /* but you can replace them with your own styles. */
  .full-window {
    width: 100%;
    height: 95vh;
    box-sizing: border-box;
    border: none;
    outline: none;
    border-radius: 25px;
    border: 2px solid #2d3748;
    padding: 20px;
  }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .bg-gray-100 { background-color: #f7fafc; }
   
  .text-center { text-align: center; }
  .text-4xl { font-size: 2.25rem; }
  .font-bold { font-weight: 700; }
  .text-gray-800 { color: #2d3748; }
  .mb-2 { margin-bottom: 0.5rem; }
  .text-lg { font-size: 1.125rem; }
  .text-gray-600 { color: #718096; }
  .mt-8 { margin-top: 2rem; }
  .w-24 { width: 6rem; }
  .h-24 { height: 6rem; }
  .text-blue-500 { color: #4299e1; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .5; }
  }
  .mt-4 { margin-top: 1rem; }
  .text-gray-500 { color: #a0aec0; }
  .font-semibold { font-weight: 600; }
</style>
