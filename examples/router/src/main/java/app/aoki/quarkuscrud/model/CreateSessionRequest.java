package app.aoki.quarkuscrud.model;

import jakarta.validation.constraints.Size;

/**
 * Request DTO for creating controller session
 */
public class CreateSessionRequest {
    
    @Size(max = 100, message = "Session name must not exceed 100 characters")
    private String name;
    
    public CreateSessionRequest() {}
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
}
