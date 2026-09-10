//Stored Procedure---sp_RegisterUser--14
//----Kullanıcı kayıt olurken Java bu SP'yi çağırır. Şifreyi ve rolü parametre geçer.
package com.skyfull.repository;

import com.skyfull.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.query.Procedure;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    User findByUsername(String username);

    @Procedure(procedureName = "sp_RegisterUser")
    void registerUser(String username, String password, String fullName, String role);
}
