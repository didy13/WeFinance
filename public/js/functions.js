function checkBalance() {
    const balansInput = document.getElementById("balans").value;
    
    if (balansInput === '' || isNaN(balansInput)) {
        alert("Morate popuniti balans!"); // show alert
        return false; // prevent form submission
    }
    
    return true; // allow form submission
}