<script>
  import { createEventDispatcher } from 'svelte';

  // The RFID string is passed in from the parent component.
  export let rfid = '';

  let idNumber = '';
  let studentName = '';

  const dispatch = createEventDispatcher();

  // Function to handle the form submission.
  function handleSubmit() {
    if (idNumber.trim() && studentName.trim()) {
      // Dispatch a 'register' event with the form data.
      dispatch('register', {
        rfid,
        idNumber,
        studentName
      });
    } else {
      alert('Please fill in all fields.');
    }
  }

  // Function to close the modal.
  function closeModal() {
    dispatch('close');
  }
</script>

<!-- Modal Backdrop -->
<div
  class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
  on:click={closeModal}
  role="button"
  tabindex="0"
  aria-label="Close registration modal"
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') closeModal(); }}
>
  <!-- Modal Content -->
  <div
    class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md"
    on:click|stopPropagation
    role="dialog"
    aria-modal="true"
    tabindex="0"
    on:keydown|stopPropagation
  >
    <h2 class="text-2xl font-bold mb-4 text-gray-800">Register Student</h2>
    
    <form on:submit|preventDefault={handleSubmit}>
      <!-- RFID Field (Read-only) -->
      <div class="mb-4">
        <label for="rfid" class="block text-gray-700 text-sm font-bold mb-2 ">RFID Tag</label>
        <input 
          type="text" 
          id="rfid" 
          bind:value={rfid} 
          readonly
          class="rounded-lg shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
        >
      </div>

      <!-- ID Number Field -->
      <div class="mb-4">
        <label for="idNumber" class="block text-gray-700 text-sm font-bold mb-2">ID Number</label>
        <input 
          type="text" 
          id="idNumber" 
          bind:value={idNumber}
          placeholder="e.g., 2023-12345"
          required
          class="rounded-lg shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
        >
      </div>

      <!-- Student Name Field -->
      <div class="mb-6">
        <label for="studentName" class="block text-gray-700 text-sm font-bold mb-2">Student Name</label>
        <input 
          type="text" 
          id="studentName" 
          bind:value={studentName}
          placeholder="e.g., Juan Dela Cruz"
          required
          class="rounded-lg shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
        >
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end space-x-4">
        <button 
          type="button" 
          on:click={closeModal}
          class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Cancel
        </button>
        <button 
          type="submit"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Register
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Basic styles for the modal - you can customize these extensively */
  .flex { display: flex; }
  .justify-center { justify-content: center; }
  .items-center { align-items: center; }
  .justify-end { justify-content: flex-end; }
  .fixed { position: fixed; }
  .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
  .bg-black { background-color: #000; }
  .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5); }
  .z-50 { z-index: 50; }
  .bg-white { background-color: #091223; }
  .rounded-lg { border-radius: 0.5rem; }
  .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
  .p-8 { padding: 2rem; }
  .w-full { width: 90%; }
  .max-w-md { max-width: 28rem; }
  .text-2xl { font-size: 1.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .block { display: block; }
  .text-sm { font-size: 0.875rem; }
  .text-gray-700 { color: #4a5568; }
  .bg-gray-200 { background-color: #e2e8f0; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .leading-tight { line-height: 1.25; }
  .focus\:outline-none:focus { outline: 0; }
  .focus\:shadow-outline:focus { box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5); }
  .space-x-4 > :not([hidden]) ~ :not([hidden]) { margin-left: 1rem; }
  .hover\:bg-gray-700:hover { background-color: #4a5568; }
  .hover\:bg-blue-700:hover { background-color: #2b6cb0; }
</style>
